#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <HX711.h>
#include <Preferences.h>
#include <nvs_flash.h>

#define WIPE false // if true the nvs partition and all saved values will be wiped

// ----------------------- MQTT-Server Settings ---------------------  //
#define SSID "Postmelder-Wifi"
IPAddress mqttServer(10, 42, 0, 1);
#define MQTT_USER "MQTTBroker"
#define MQTT_PASS "postmelder"

// -----------------------  SCALE Settings --------------------------  //
#define SCALE_THRESHOLD 2.0 // value in grams, above or below which no change will be reported in grams
#define SCALE_DATA_PIN 32
#define SCALE_CLOCK_PIN 33

// ------------------------------- Pinout ----------------------------  //
#define R_LED_PIN 0
#define G_LED_PIN 2
#define B_LED_PIN 15

// ------------------------- PMW Blinking ------------------------------ //
#define CHANNEL_BLAU 0
#define CHANNEL_ROT 1
#define BLINKEN_EIN 100
#define BLINKEN_AUS 0

WiFiClient wiFiClient;
PubSubClient client(wiFiClient);
HX711 scale;			 // scale object
Preferences preferences; // preferences object
float weight = 0;		 // scale measurement variables
float scaleValue;		 // calibrated scale values -> Flash
long scaleOffset;		 // -> Flash
bool scaleInitialised;	 // saves whether the scale has already been calibrated-> Flash
const String MAC = WiFi.macAddress();
bool connectedWithNode = false;
bool isServerOnline = false;

// Function declarations
void updateLEDs();
void setStateOccupied(bool value);
void setStateError(bool value);
void setStateInit(bool value);
void callback(char *topic, byte *message, unsigned int length);
void reconnect();
void sendWeight(float weight);
void calibrateScale();
float readScale();

/*
	Bits: 		Func
	0	:		INIT
	1	:		OCCUPIED
	2-6	:		reserver
	7	: 		ERR
*/
char state = 0b000;

void setup()
{
#if WIPE			   // if wipe is defined
	nvs_flash_erase(); // format nvs-partition
	nvs_flash_init();  // initialise nvs-partition
#endif

	setStateOccupied(false);
	setStateError(false);
	setStateInit(true);

	Serial.begin(115200); // Serial connection to PC

	pinMode(R_LED_PIN, OUTPUT);
	pinMode(G_LED_PIN, OUTPUT);
	pinMode(B_LED_PIN, OUTPUT);
	// blinken lassen

	ledcSetup(0, 1, 12); // PWM für Blaue LED
	ledcSetup(1, 1, 12); // PWM für Rote LED
	ledcAttachPin(B_LED_PIN, 0);
	ledcAttachPin(R_LED_PIN, 1);

	// Connect to WiFi
	Serial.print("Connect to: ");
	Serial.println(SSID);
	WiFi.begin(SSID);

	client.setServer(mqttServer, 1883);
	client.setCallback(callback);
	preferences.begin("postmelder", false); // start preferences

	scale.begin(SCALE_DATA_PIN, SCALE_CLOCK_PIN); // start scale

	scaleInitialised = preferences.getBool("initialised"); // read flag from flash

	if (!scaleInitialised)
	{ // if scale not initialised
		Serial.println("not yet initialised, start manual calibration!");
	}
	else
	{ // read values from flash if already initialised
		Serial.println("already initialised, loading values...");

		scaleValue = preferences.getFloat("scaleValue", 0); // read values from flash
		scaleOffset = preferences.getLong("scaleOffset", 0);

		Serial.print("ScaleValue: "); // print them to the serial monitor
		Serial.print(scaleValue);
		Serial.print(", ScaleOffset: ");
		Serial.println(scaleOffset);

		scale.set_offset(scaleOffset); // set scale values
		scale.set_scale(scaleValue);

		weight = readScale(); // inital reading to discard any weird measurements
	}

	preferences.end(); // close preferences
}

void loop()
{
	// TODO: Optimieren wann welche Status LED blinkt
	if (WiFi.status() != WL_CONNECTED)
	{
		if (!(state &= 1 << 0)) // state unequal Init
		{
			setStateError(true);
		}
	}
	else
	{
		reconnect();
	}

	if (scale.is_ready()) // check if scale is ready
	{
		static bool weightChange;			  // saves if weight changed above or below threshold inbetween two readings
		static bool printed;				  // saves wether settled weight has already been sent via MQTT and printed to the serial monitor
		static float previousWeight = weight; // saves the value of the previous measurement
		weight = readScale();

		if (weight >= previousWeight + SCALE_THRESHOLD || weight <= previousWeight - SCALE_THRESHOLD)
		{ // if weight changed above or below threshold
			weightChange = true;
			printed = false;

			Serial.print("Change detected, weight: "); // print to serial monitor
			Serial.print(weight, 1);
			Serial.println("g");

			previousWeight = weight;
			weight = readScale();

			delay(250);
		}
		else
		{
			weightChange = false;
		}

		if (!weightChange && !printed)
		{									// if weight changed over threshold
			Serial.print("final weight: "); // print to serial monitor
			Serial.print(weight);
			Serial.println("g");

			weightChange = false; // reset change

			sendWeight(weight); // send weight over MQTT

			printed = true;
		}
	}
	else
	{
		// TODO: Fehler anzeigen
	}

	client.loop();

	updateLEDs();
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

	if (!(state &= 1 << 0)) // state unequal Init
	{
		setStateError(true);
	}

	// TODO: Get MAC Address as ID
	if (client.connect(MAC.c_str(), MQTT_USER, MQTT_PASS, ("/" + MAC + "/online").c_str(), 1, true, "disconnected"))
	{
		client.subscribe(("/" + MAC + "/#").c_str());
		client.subscribe("/server/online");

		// Sending device now available
		client.publish("/devices", MAC.c_str());
		client.publish(("/" + MAC + "/online").c_str(), "connected", true);
		setStateInit(false);
		setStateError(false);
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
{ // calibrates the scale with a user dialog via the serial monitor and saves the results to flash
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

	preferences.begin("postmelder", false); // start preferences

	scaleInitialised = true;

	preferences.putFloat("scaleValue", scaleValue); // save values to flash
	preferences.putLong("scaleOffset", scaleOffset);
	preferences.putBool("scaleInitialised", scaleInitialised);

	preferences.end(); // close preferences
}

float readScale()
{ // reads the scale
	float value = 0;

	value = scale.get_units(20); // mean of 20 measurements

	return value;
}

void updateLEDs()
{
	// Error
	if (state & 1 << 7)
	{
		ledcWrite(CHANNEL_ROT, BLINKEN_EIN);
		ledcWrite(CHANNEL_BLAU, BLINKEN_AUS);
		digitalWrite(G_LED_PIN, LOW);
	}
	// Setup
	else if (state & 1 << 0)
	{
		ledcWrite(CHANNEL_ROT, BLINKEN_AUS);
		ledcWrite(CHANNEL_BLAU, BLINKEN_EIN);
		digitalWrite(G_LED_PIN, LOW);
	}
	// Occupied
	else if (state & 1 << 1)
	{
		ledcWrite(CHANNEL_ROT, BLINKEN_AUS);
		ledcWrite(CHANNEL_BLAU, BLINKEN_AUS);
		digitalWrite(G_LED_PIN, HIGH);
	}
	else
	{
		ledcWrite(CHANNEL_ROT, BLINKEN_AUS);
		ledcWrite(CHANNEL_BLAU, BLINKEN_AUS);
		digitalWrite(G_LED_PIN, LOW);
	}
}

void setStateOccupied(bool value)
{
	value ? state |= 1 << 1 : state &= ~(1 << 1); // Set/Reset Occupied Bit if value true/false
}

void setStateError(bool value)
{
	value ? state |= 1 << 7 : state &= ~(1 << 7); // Set/Reset Error Bit if value true/false
}

void setStateInit(bool value)
{
	value ? state |= 1 << 0 : state &= ~(1 << 0); // Set/Reset Init Bit if value true/false
}