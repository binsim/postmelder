#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

#include "configuration.h"
#include "state.h"
#include "Scale.h"
#include "MqttUtils.h"

State state;
Scale scale;

bool connectedWithNode = false;
bool isServerOnline = false;

// Function declarations
void callback(SubTopic topic, String payload);

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

	setupMqtt(callback);
	scale.init();

	Serial.println("###################################  Setup Done!!! ################################");
}

void loop()
{
	mqttLoop();
	bool wiFiConnected = WiFi.status() == WL_CONNECTED;

	state.setState(States::COMMUNICATION_ERR, !wiFiConnected || !isServerOnline || !connectedWithNode);

	if (scale.weightChanged())
	{
		float weight = scale.getCurrentWeight();

		publish(PubTopic::WEIGHT_UPDATE, String(weight, 1), true);
		state.setState(States::OCCUPIED, weight > 1);
	}
	state.loop();
}

void callback(SubTopic topic, String message)
{
	switch (topic)
	{
	case SubTopic::DEVICE_REGISTERED:
		connectedWithNode = true;
		break;
	case SubTopic::SERVER_ONLINE:
	{
		if (message == "disconnected" || message == "connected")
		{
			isServerOnline = message == "connected";
			if (isServerOnline)
			{
				state.setState(States::INIT, false);

				publish(PubTopic::REGISTER_DEVICE);
				break;
			}
			connectedWithNode = false;
		}
		break;
	}
	case SubTopic::COMMAND_CALC_OFFSET:
		state.setState(States::SCALE_CALIBRATION, true);
		publish(PubTopic::SCALE_OFFSET, String(scale.calibrateScaleOffset(), 2));
		break;
	case SubTopic::COMMAND_CALC_FACTOR:
		publish(PubTopic::SCALE_FACTOR, String(scale.calibrateScaleFactor(message.toInt()), 2));
		break;
	case SubTopic::COMMAND_APPLY_CALIBRATION:
		scale.saveScaleValues();
		state.setState(States::SCALE_CALIBRATION, false);
		break;
	case SubTopic::COMMAND_CANCEL_CALIBRATION:
		scale.cancelCalibration();
		state.setState(States::SCALE_CALIBRATION, false);
		break;
	default:
		break;
	}
}
