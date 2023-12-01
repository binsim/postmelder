#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ----------------------- MQTT-Server Settings ---------------------  //
#define SSID "Postmelder-Wifi"
IPAddress mqttServer(10, 42, 0, 1);
#define MQTTUSER "MQTTBroker"
#define MQTTPASS "postmelder"

// ------------------------------- Pinout ----------------------------  //
#define R_LED_PIN 2
#define G_LED_PIN 3
#define B_LED_PIN 4

// ------------------------- PMW Blinking ------------------------------ //
#define CHANNEL_BLAU 0
#define CHANNEL_ROT 1
#define BLINKEN_EIN 100
#define BLINKEN_AUS 0

WiFiClient wiFiClient;
PubSubClient client(wiFiClient);

void callback(char *topic, byte *message, unsigned int length);
void reconnect();
void sendWeight(float weight);
void updateLEDs();
void setStateOccupied(bool value);
void setStateError(bool value);
void setStateSetUP(bool value);

const String MAC = WiFi.macAddress();
bool connectedWithNode = false;
bool isServerOnline = false;

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
	Serial.begin(115200);

	pinMode(R_LED_PIN, OUTPUT);
	pinMode(G_LED_PIN, OUTPUT);
	pinMode(B_LED_PIN, OUTPUT);
	// blinken lassen

	ledcSetup(0, 10, 12); // PWM für Blaue LED
	ledcSetup(1, 10, 12); // PWM für Rote LED
	ledcAttachPin(B_LED_PIN, 0);
	ledcAttachPin(R_LED_PIN, 1);

	// Connect to WiFi
	Serial.print("Connect to: ");
	Serial.println(SSID);
	WiFi.begin(SSID);

	client.setServer(mqttServer, 1883);
	client.setCallback(callback);

	setStateOccupied(false);
	setStateError(false);
	setStateSetUP(true);
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

	// TODO: Get MAC Address as ID
	if (client.connect(MAC.c_str(), MQTTUSER, MQTTPASS, ("/" + MAC + "/online").c_str(), 1, true, "disconnected"))
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

void updateLEDs()
{
	// Error
	if (state & 1 << 7)
	{
		ledcWrite(CHANNEL_ROT, BLINKEN_EIN);
		ledcWrite(CHANNEL_BLAU, BLINKEN_AUS);
		digitalWrite(G_LED_PIN, LOW);
	}
	else if (state & 1 << 0)
	{
		ledcWrite(CHANNEL_ROT, BLINKEN_AUS);
		ledcWrite(CHANNEL_BLAU, BLINKEN_EIN);
		digitalWrite(G_LED_PIN, LOW);
	}
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
	static bool currentVal = false;

	if (value == currentVal)
		return;
	currentVal = value;
	digitalWrite(G_LED_PIN, value ? HIGH : LOW);
}

void setStateError(bool value)
{
	static bool currentVal = false;

	if (value == currentVal)
		return;
	currentVal = value;
	if (value)
	{
		ledcWrite(CHANNEL_ROT, BLINKEN_EIN);
	}
	else
	{
		ledcWrite(CHANNEL_ROT, BLINKEN_AUS);
	}
}

void setStateSetUP(bool value)
{
	static bool currentVal = false;

	if (value == currentVal)
		return;
	currentVal = value;
	if (value)
	{
		ledcWrite(CHANNEL_BLAU, BLINKEN_EIN);
	}
	else
	{
		ledcWrite(CHANNEL_BLAU, BLINKEN_AUS);
	}
}