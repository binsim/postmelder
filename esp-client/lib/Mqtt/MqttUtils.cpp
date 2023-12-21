#include "MqttUtils.h"

// convert received topic to enum
const SubTopic getSubTopic(const char *topic)
{
	// Notify user using serial
	Serial.print("Received topic '");
	Serial.print(topic);
	Serial.println("' is yet undefined");

	if (strcmp(topic, "/server/online") == 0)
		return SubTopic::SERVER_ONLINE;

	const String topicStr(topic);
	const String deviceID = "/" + WiFi.macAddress();

	if (topicStr == deviceID)
		return SubTopic::DEVICE_REGISTERED;
	if (topicStr == deviceID + "/command/CalcOffset")
		return SubTopic::COMMAND_CALC_OFFSET;
	if (topicStr == deviceID + "/command/CalibrateScale")
		return SubTopic::COMMAND_CALC_FACTOR;
	if (topicStr == deviceID + "/command/ApplyCalibration")
		return SubTopic::COMMAND_APPLY_CALIBRATION;
	if (topicStr == deviceID + "/command/CancelCalibration")
		return SubTopic::COMMAND_CANCEL_CALIBRATION;

	return SubTopic::UNDEFINED;
}

// Necessary objects for mqtt communication
IPAddress mqttServer(SERVER_IP);
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
		message += (char)payload[i];
	}

	// Print topic and message for debug reasons
	Serial.print("Message arrived on topic: '");
	Serial.print(topic);
	Serial.print("' Message: '");
	Serial.print(message);
	Serial.println("'");

	// Forward callback to the user
	subCallback(getSubTopic(topic), message);
}

// Set broker and callback
void setupMqtt(SubCallback callback)
{
	subCallback = callback;

	mqttClient.setServer(mqttServer, 1883);
	mqttClient.setCallback(mqttCallback);
}

void mqttLoop()
{

	if (WiFi.status() != WL_CONNECTED)
		return;

	// This function has to be called repeatedly for the broker to work
	mqttClient.loop();

	if (mqttClient.connected())
	{
		return;
	}

	String willTopic = ("/" + WiFi.macAddress() + "/online").c_str();

	// Reconnect to broker if it is not already connected

	if (mqttClient.connect(WiFi.macAddress().c_str(), MQTT_USER, MQTT_PASS, willTopic.c_str(), 1, true, "disconnected"))
	// if (mqttClient.connect(WiFi.macAddress().c_str(), MQTT_USER, MQTT_PASS))
	{
		// Subscribe to all SubTopics
		mqttClient.subscribe(("/" + WiFi.macAddress() + "/#").c_str(), 1);
		mqttClient.subscribe("/server/online", 1);

		// Update last will topic to be connected
		mqttClient.publish(willTopic.c_str(), "connected", true);
	}
	else
	{
		// Print connection error
		Serial.print("failed, rc=");
		Serial.println(mqttClient.state());
		Serial.print("IP-Address: ");
		Serial.println(WiFi.localIP());
		// delay(1000);
	}
}

void publish(PubTopic topic, String payload, bool retain)
{
	if (topic == PubTopic::REGISTER_DEVICE)
	{
		mqttClient.publish("/devices", WiFi.macAddress().c_str());
		Serial.println("Device published register");
		return;
	}

	String topicStr = "/" + WiFi.macAddress();
	switch (topic)
	{
		// To register this device we send the server our mac address
	case PubTopic::SCALE_OFFSET:
		topicStr += "/calibration/scaleOffset";
		break;
	case PubTopic::SCALE_FACTOR:
		topicStr += "/calibration/scaleValue";
		break;
	case PubTopic::WEIGHT_UPDATE:
		topicStr += "/currentWeight";
		break;
	default:
		return;
	}
	mqttClient.publish(topicStr.c_str(), payload.c_str(), retain);
}