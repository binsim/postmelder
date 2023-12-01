#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <HX711.h>
#include <Preferences.h>
#include <nvs_flash.h>

#define WIPE false // if true the nvs partition and all saved values will be wiped

#define SSID "Postmelder-Wifi"
IPAddress mqttServer(10, 42, 0, 1);
#define MQTT_USER "MQTTBroker"
#define MQTT_PASS "postmelder"

#define SCALE_THRESHOLD 2.0 // value in grams, above or below which no change will be reported in grams
#define SCALE_DATA_PIN 32
#define SCALE_CLOCK_PIN 33

WiFiClient wiFiClient;
PubSubClient client(wiFiClient);

HX711 scale;			 // scale object
Preferences preferences; // preferences object

float weight = 0;	   // scale measurement variables
bool weightChange = 0; // saves whether weight has changed

float scaleValue;	   // calibrated scale values -> Flash
long scaleOffset;	   // -> Flash
bool scaleInitialised; // saves whether the scale has already been calibrated-> Flash

const String MAC = WiFi.macAddress();
bool connectedWithNode = false;
bool isServerOnline = false;

void callback(char *topic, byte *message, unsigned int length);
void reconnect();
void sendWeight(float weight);
void calibrateScale();
float readScale();

void setup()
{
#if WIPE			   // if wipe is defined
	nvs_flash_erase(); // format nvs-partition
	nvs_flash_init();  // initialise nvs-partition
#endif

	Serial.begin(115200); // Serial connection to PC

	// Connect to WiFi
	Serial.print("Connect to: ");
	Serial.println(SSID);
	WiFi.begin(SSID);

	client.setServer(mqttServer, 1883);
	client.setCallback(callback);
	preferences.begin("postmelder", false); // start preferences

	scale.begin(SCALE_DATA_PIN, SCALE_CLOCK_PIN); // start scale
	while (!scale.is_ready())
	{ // wait until scale started
		delay(100);
	}

	scaleInitialised = preferences.getBool("initialised"); // read flag from flash

	if (!scaleInitialised)
	{ // calibrate and write values to flash if not initialised

		Serial.println("not yet initialised, starting calibration");
		calibrateScale();

		scaleInitialised = true;

		preferences.putFloat("scaleValue", scaleValue); // save values to flash
		preferences.putLong("scaleOffset", scaleOffset);
		preferences.putBool("initialised", scaleInitialised);
	}
	else
	{ // read values from flash if already initialised
		Serial.println("already initialised, loading values...");

		scaleValue = preferences.getFloat("scaleValue", 0);
		scaleOffset = preferences.getLong("scaleOffset", 0);

		scale.set_offset(scaleOffset); // set scale values
		scale.set_scale(scaleValue);
	}

	preferences.end(); // close preferences
	weight = readScale();
}

void loop()
{
	if (WiFi.status() != WL_CONNECTED)
	{
		// TODO: Show Output RGB
	}
	else
	{
		reconnect();
	}

	if (scale.is_ready())
	{ // check if scale is ready
		static float previousWeight = weight;
		weight = readScale();

		while (weight >= previousWeight + SCALE_THRESHOLD || weight <= previousWeight - SCALE_THRESHOLD)
		{ // if weight changed above or below threshold loop until weight has settled in
			weightChange = true;

			Serial.print("Change detected, weight: "); // print to serial monitor
			Serial.print(weight, 1);
			Serial.println("g");

			previousWeight = weight;
			weight = readScale();

			delay(250);
		}

		if (weightChange)
		{									// if weight changed over threshold
			Serial.print("final weight: "); // print to serial monitor
			Serial.print(weight);
			Serial.println("g");

			weightChange = false; // reset change

			sendWeight(weight); // send weight over MQTT
		}
	}

	client.loop();
}
void callback(char *topic, byte *message, unsigned int length)
{
	String messageTemp;
	String topicStr(topic);

	Serial.print("Message arrived on topic: '");
	Serial.print(topic);
	Serial.print("' Message: '");

	for (int i = 0; i < length; i++)
	{
		Serial.print((char)message[i]);
		messageTemp += (char)message[i];
	}
	Serial.println("'");

	if (topicStr == ("/" + MAC))
	{
		// TODO: Handle case
		connectedWithNode = true;
	}
	else if (topicStr == "/server/online")
	{
		// TODO: Let user know
		if (messageTemp != "connected" && messageTemp != "disconnected")
			return;
		isServerOnline = messageTemp == "connected";
	}
}
void reconnect()
{

	if (client.connected())
		return;

	// TODO: Get MAC Address as ID
	if (client.connect(MAC.c_str(), MQTT_USER, MQTT_PASS, ("/" + MAC + "/online").c_str(), 1, true, "disconnected"))
	{
		client.subscribe(("/" + MAC + "/#").c_str());
		client.subscribe("/server/online");

		// Sending device now available
		client.publish("/devices", MAC.c_str());
		client.publish(("/" + MAC + "/online").c_str(), "connected", true);
	}
	else
	{
		Serial.print("failed, rc=");
		Serial.println(client.state());
		delay(1000);
	}
}
void sendWeight(float weight)
{
	client.publish(("/" + MAC + "/currentWeight").c_str(), String(weight, 1).c_str(), true);
}

void calibrateScale()
{ // calibrates the scale with a user dialog via the serial monitor
	Serial.println("\n\nCalibration\n===========");
	Serial.println("remove all weight from the scale");
	//  flush Serial input
	while (Serial.available())
		Serial.read();

	Serial.println("and press enter, 'New Line' has to be activated in the serial monitor"
				   "\n");
	while (Serial.available() == 0)
		;

	Serial.println("calculating scaleOffset");
	scale.tare(20); // mean of 20 measurements
	scaleOffset = scale.get_offset();

	Serial.print("scaleOffset: ");
	Serial.println(scaleOffset);
	Serial.println();

	Serial.println("place known weight on scale");
	//  flush Serial input
	while (Serial.available())
		Serial.read();

	Serial.println("type in the weight in whole grams and press enter");
	uint32_t weight = 0;
	while (Serial.peek() != '\n')
	{
		if (Serial.available())
		{
			char ch = Serial.read();
			if (isdigit(ch))
			{
				weight *= 10;
				weight = weight + (ch - '0');
			}
		}
	}

	Serial.print("WEIGHT: ");
	Serial.println(weight);
	scale.calibrate_scale(weight, 20);

	scaleValue = scale.get_scale();

	Serial.println(scaleValue, 6);
	scale.set_offset(scaleOffset); // set scale values
	scale.set_scale(scaleValue);

	Serial.println("\n\n");
}

float readScale()
{ // reads the scale
	float value = 0;

	value = scale.get_units(20); // mean of 20 measurements

	return value;
}