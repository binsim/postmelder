#include <Arduino.h>
#include <functional>
#include <WiFi.h>
#include <PubSubClient.h>

#include "configuration.h"

// All topic we subscribe to
enum SubTopic
{
	UNDEFINED,
	SERVER_ONLINE,
	DEVICE_REGISTERED,
	COMMAND_CALC_OFFSET,
	COMMAND_CALC_FACTOR,
	COMMAND_APPLY_CALIBRATION,
	COMMAND_CANCEL_CALIBRATION
};
// All topics we can publish
enum PubTopic
{
	SCALE_OFFSET,
	SCALE_FACTOR,
	WEIGHT_UPDATE,
	REGISTER_DEVICE
};

typedef std::function<void(SubTopic, String)> SubCallback;

void mqttLoop();
void setupMqtt(SubCallback callback);
void publish(PubTopic topic, String payload = "", bool retain = false);