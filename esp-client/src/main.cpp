#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

#include "configuration.h"
#include "state.h"
#include "Scale.h"

WiFiClient wiFiClient;
IPAddress mqttServer(SERVER_IP);
PubSubClient client(wiFiClient);
State state;
Scale scale;
const String MAC = WiFi.macAddress();
// FIXME: Value never read
bool connectedWithNode = false;
// FIXME: Value never read
bool isServerOnline = false;

// Function declarations
void callback(char *topic, byte *message, unsigned int length);
void reconnect();
void sendWeight(float weight);

void setup()
{
	Serial.begin(115200); // Serial connection to PC
	delay(100);			  // Wait for loading on PC
	Serial.println("###################################  STARTUP ################################");
	state.init();

#ifdef WIPE // if wipe is defined
	scale.wipeFlash();
#endif

	// Connect to WiFi
	Serial.print("Connect to: ");
	Serial.println(SSID);
	WiFi.begin(SSID);

	client.setServer(mqttServer, 1883);
	client.setCallback(callback);

	scale.init();

	Serial.println("###################################  Setup Done!!! ################################");
}

void loop()
{
	if (WiFi.status() != WL_CONNECTED)
	{
		state.setState(States::COMMUNICATION_ERR, true);
	}
	else
	{
		reconnect();
	}

	if (scale.weightChanged())
	{
		float weight = scale.getCurrentWeight();

		sendWeight(weight);
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
		if (messageTemp == "connected")
		{
			state.setState(States::INIT, false);
			state.setState(States::COMMUNICATION_ERR, false);
		}
		else
		{
			state.setState(States::COMMUNICATION_ERR, true);
		}
	}
	else if (topicStr == "/" + MAC + "/command/CalcOffset")
	{
		float scaleOffset = scale.calibrateScaleOffset();
		client.publish(("/" + MAC + "/calibration/scaleOffset").c_str(), String(scaleOffset, 2).c_str());
	}
	else if (topicStr == "/" + MAC + "/command/CalibrateScale")
	{
		float scaleValue = scale.calibrateScaleFactor(atoi(messageTemp.c_str()));
		client.publish(("/" + MAC + "/calibration/scaleValue").c_str(), String(scaleValue, 2).c_str());
	}
	else if (topicStr == "/" + MAC + "/command/ApplyCalibration")
	{
		scale.saveScaleValues();
	}
	else if (topicStr == "/" + MAC + "/command/CancelCalibration")
	{
		scale.cancelCalibration();
	}
}
void reconnect()
{
	if (client.connected())
		return;

	// TODO: Get MAC Address as ID
	if (client.connect(MAC.c_str(), MQTT_USER, MQTT_PASS, ("/" + MAC + "/online").c_str(), 1, true, "disconnected"))
	{
		client.subscribe(("/" + MAC + "/#").c_str(), 1);
		client.subscribe("/server/online", 1);
		// Sending device now available
		client.publish("/devices", MAC.c_str());
		client.publish(("/" + MAC + "/online").c_str(), "connected", true);
	}
	else
	{
		state.setState(States::COMMUNICATION_ERR, true);

		Serial.print("failed, rc=");
		Serial.println(client.state());
		delay(1000);
	}
}
void sendWeight(float weight)
{
	client.publish(("/" + MAC + "/currentWeight").c_str(), String(weight, 1).c_str(), true);
}