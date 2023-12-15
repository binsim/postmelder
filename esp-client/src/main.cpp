#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <HX711.h>
#include <Preferences.h>
#include <nvs_flash.h>

#include "configuration.h"
#include "state.h"

WiFiClient wiFiClient;
IPAddress mqttServer(SERVER_IP);
PubSubClient client(wiFiClient);
State state;
HX711 scale;			 // scale object
Preferences preferences; // preferences object
float weight = 0;		 // scale measurement variables
float scaleValue;		 // calibrated scale values -> Flash
long scaleOffset;		 // -> Flash
bool scaleInitialised;	 // saves whether the scale has already been calibrated-> Flash
const String MAC = WiFi.macAddress();
// FIXME: Value never read
bool connectedWithNode = false;
// FIXME: Value never read
bool isServerOnline = false;

// Function declarations
void callback(char *topic, byte *message, unsigned int length);
void reconnect();
void sendWeight(float weight);
void calibrateScale();
float readScale();

float calibrateScaleOffset();
float calibrateScaleFactor(unsigned int grams);
void saveScaleValues();
void loadScaleValues();

void setup()
{
	Serial.begin(115200); // Serial connection to PC
	delay(100);
	Serial.println("###################################  STARTUP ################################");
	state.setupLEDs();
	state.setState(States::INIT, true);

#ifdef WIPE			   // if wipe is defined
	nvs_flash_erase(); // format nvs-partition
	nvs_flash_init();  // initialise nvs-partition
#endif

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

		loadScaleValues(); // load values from flash

		Serial.print("ScaleValue: "); // print them to the serial monitor
		Serial.print(scaleValue);
		Serial.print(", ScaleOffset: ");
		Serial.println(scaleOffset);

		weight = readScale(); // inital reading to discard any weird measurements
	}

	preferences.end(); // close preferences
	Serial.println("###################################  Setup Done!!! ################################");
}

void loop()
{
	static byte init_counter = 0;
	if (state.isInit())
	{
		init_counter++;
		if (init_counter > 3)
		{
			state.setState(States::INIT, false);
		}
	}
	// TODO: Optimieren wann welche Status LED blinkt
	if (WiFi.status() != WL_CONNECTED)
	{
		if (!state.isInit()) // state unequal Init
		{
			state.setState(States::COMMUNICATION_ERR, true);
		}
	}
	else
	{
		reconnect();
	}

	// FIXME: It does not get detected when no scale is connected
	if (scale.is_ready()) // check if scale is ready
	{
		Serial.println("scale is ready!");

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

	client.loop();
	state.loop();
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
	else if (topicStr == "/" + MAC + "/command/CalcOffset")
	{
		scaleOffset = calibrateScaleOffset();
		client.publish(("/" + MAC + "/calibration/scaleOffset").c_str(), String(scaleOffset, 2).c_str());
		Serial.print("CalcOffset Message sent");
	}
	else if (topicStr == "/" + MAC + "/command/CalibrateScale")
	{
		scaleValue = calibrateScaleFactor(atoi(messageTemp.c_str()));
		client.publish(("/" + MAC + "/calibration/scaleValue").c_str(), String(scaleValue, 2).c_str());
	}
	else if (topicStr == "/" + MAC + "/command/ApplyCalibration")
	{
		saveScaleValues();
	}
	else if (topicStr == "/" + MAC + "/command/CancelCalibration")
	{
		loadScaleValues();
	}
}
void reconnect()
{
	if (client.connected())
		return;

	if (!state.isInit())
	{
		state.setState(States::COMMUNICATION_ERR, true);
	}

	// TODO: Get MAC Address as ID
	if (client.connect(MAC.c_str(), MQTT_USER, MQTT_PASS, ("/" + MAC + "/online").c_str(), 1, true, "disconnected"))
	{
		client.subscribe(("/" + MAC + "/#").c_str(), 1);
		client.subscribe("/server/online", 1);
		// Sending device now available
		client.publish("/devices", MAC.c_str());
		client.publish(("/" + MAC + "/online").c_str(), "connected", true);
		state.setState(States::INIT, false);
		state.setState(States::COMMUNICATION_ERR, false);
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

float readScale()
{ // reads the scale
	float value = 0;

	value = scale.get_units(20); // mean of 20 measurements

	return value;
}

float calibrateScaleOffset() // tares the scale when no weight is present
{
	Serial.println("calculating scaleOffset");
	scale.tare(20); // mean of 20 measurements
	scaleOffset = scale.get_offset();

	Serial.print("scaleOffset: ");
	Serial.println(scaleOffset);
	Serial.println();

	return scaleOffset;
}

float calibrateScaleFactor(unsigned int grams) // calculates the scale conversion factor using a known weight in whole grams
{
	Serial.println("calculating scale conversion factor...");

	scale.calibrate_scale(grams, 20);
	scaleValue = scale.get_scale();

	Serial.print("conversion factor: "); // print result to serial monitor
	Serial.println(scaleValue);

	return scaleValue;
}

void saveScaleValues() // saves the current scale values to flash
{
	preferences.begin("postmelder", false); // start preferences

	if (scaleValue != 0 && scaleOffset != 0) // check if both scale parameters have been set
	{
		scaleInitialised = true; // set initialised-flag
	}
	else
	{
		scaleInitialised = false;
	}

	preferences.putFloat("scaleValue", scaleValue); // save values to flash
	preferences.putLong("scaleOffset", scaleOffset);
	preferences.putBool("initialised", scaleInitialised);

	preferences.end(); // close preferences
}

void loadScaleValues()
{											// loads and applies the scale values saved in flash
	preferences.begin("postmelder", false); // start preferences

	scaleValue = preferences.getFloat("scaleValue", 0); // read values from flash
	scaleOffset = preferences.getLong("scaleOffset", 0);

	scale.set_offset(scaleOffset); // set scale values
	scale.set_scale(scaleValue);

	preferences.end(); // close preferences
}