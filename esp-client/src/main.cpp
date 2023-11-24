#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

#define SSID "Postmelder-Wifi"
IPAddress mqttServer(10,42,0,1);
#define MQTTUSER "MQTTBroker"
#define MQTTPASS "postmelder"

WiFiClient wiFiClient;
PubSubClient client(wiFiClient);


void callback(char* topic, byte* message, unsigned int length);
void reconnect();

void setup() 
{
	Serial.begin(115200);

	// Connect to WiFi
	Serial.print("Connect to: ");
	Serial.println(SSID);
	WiFi.begin(SSID);

	client.setServer(mqttServer, 1883);
  	client.setCallback(callback);

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
}
void callback(char* topic, byte* message, unsigned int length)
{

}
void reconnect() 
{
	static String mac = WiFi.macAddress();

	if (client.connected()) return;
	
	// TODO: Get MAC Address as ID
	if (client.connect(mac.c_str(), MQTTUSER, MQTTPASS)) {
		client.publish("/devices", mac.c_str());
		client.subscribe(("/" + mac).c_str());
		client.subscribe("/server/online");
	} 
	else
	{
		Serial.print("failed, rc=");
      	Serial.println(client.state());
		delay(1000);
	}

}