#include "MqttUtils.h"

// Combine enum values with MQTT topics
std::map<PubTopic, const char *> PubTopicMap{
	{PubTopic::SCALE_OFFSET, ("/" + WiFi.macAddress() + "/calibration/scaleOffset").c_str()},
	{PubTopic::SCALE_FACTOR, ("/" + WiFi.macAddress() + "/calibration/scaleValue").c_str()},
	{PubTopic::WEIGHT_UPDATE, ("/" + WiFi.macAddress() + "/currentWeight").c_str()},
	{PubTopic::REGISTER_DEVICE, "/devices"}};

// Combine enum values with MQTT topics
std::map<SubTopic, const char *> SubTopicMap{
	{SubTopic::SERVER_ONLINE, "/server/online"},
	{SubTopic::DEVICE_REGISTERED, ("/" + WiFi.macAddress()).c_str()},
	{SubTopic::COMMAND_CALC_OFFSET, ("/" + WiFi.macAddress() + "/command/CalcOffset").c_str()},
	{SubTopic::COMMAND_CALC_FACTOR, ("/" + WiFi.macAddress() + "/command/CalibrateScale").c_str()},
	{SubTopic::COMMAND_APPLY_CALIBRATION, ("/" + WiFi.macAddress() + "/command/ApplyCalibration").c_str()},
	{SubTopic::COMMAND_CANCEL_CALIBRATION, ("/" + WiFi.macAddress() + "/command/CancelCalibration").c_str()}};

// convert received topic to enum
const SubTopic getSubTopic(const char *topic)
{
	// Check each entry if it is the topic
	for (auto i = SubTopicMap.begin(); i != SubTopicMap.end(); ++i)
	{
		if (i->second == topic)
			return i->first;
	}

	// Notify user using serial
	Serial.print("Received topic '");
	Serial.print(topic);
	Serial.println("' is yet undefined");

	return SubTopic::UNDEFINED;
}

// Necessary objects for mqtt communication
WiFiClient wiFiClient;
PubSubClient mqttClient(wiFiClient);

// The users callback
SubCallback subCallback;

void mqttCallback(char *topic, uint8_t *payload, unsigned int length)
{
	// Convert message to String
	String message;
	for (int i = 0; i < length; i++)
	{
		message += (char)message[i];
	}

	// Print topic and message for debug reasons
	Serial.print("Message arrived on topic: '");
	Serial.print(topic);
	Serial.print("' Message: '");
	Serial.println(message);

	// Forward callback to the user
	subCallback(getSubTopic(topic), message);
}

// Set broker and callback
void setupMqtt(SubCallback callback)
{
	IPAddress mqttServer(SERVER_IP);
	mqttClient.setServer(mqttServer, 1883);
	mqttClient.setCallback(mqttCallback);
}

void mqttLoop()
{
	// This function has to be called repeatedly for the broker to work
	mqttClient.loop();

	if (mqttClient.connected())
		return;

	const char *willTopic = ("/" + WiFi.macAddress() + "/online").c_str();

	// Reconnect to broker if it is not already connected
	if (mqttClient.connect(WiFi.macAddress().c_str(), MQTT_USER, MQTT_PASS, willTopic, 1, true, "disconnected"))
	{
		// Subscribe to all SubTopics
		for (auto i = SubTopicMap.begin(); i != SubTopicMap.end(); ++i)
		{
			Serial.print("Subscribe to: ");
			Serial.println(i->second);
			mqttClient.subscribe(i->second);
		}

		// Update last will topic to be connected
		mqttClient.publish(willTopic, "connected", true);
	}
	else
	{
		// Print connection error
		Serial.print("failed, rc=");
		Serial.println(mqttClient.state());
		delay(1000);
	}
}

// TODO: Make this more generic
void publish(PubTopic topic, String payload, bool retain)
{
	const char *topicStr = PubTopicMap.find(topic)->second;

	Serial.print("Published topic '");
	Serial.print(topicStr);
	Serial.print("' with payload '");
	Serial.print(payload.c_str());
	Serial.print("' ");
	Serial.print(retain ? "with" : "without");
	Serial.print(" retain flag");

	switch (topic)
	{
		// To register this device we send the server our mac address
	case PubTopic::REGISTER_DEVICE:
		mqttClient.publish(topicStr, WiFi.macAddress().c_str());
		break;

	default:
		// All other messages will be forwarded
		mqttClient.publish(topicStr, payload.c_str(), retain);
		break;
	}
}