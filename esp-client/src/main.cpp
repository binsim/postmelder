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
const String MAC = WiFi.macAddress();
bool connectedWithNode = false;


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
	client.loop();
}
void callback(char* topic, byte* message, unsigned int length)
{
  	String messageTemp;
	String topicStr(topic);

	Serial.print("Message arrived on topic: '");
  	Serial.print(topic);
  	Serial.print("' Message: '");
  
  	for (int i = 0; i < length; i++) {
    	Serial.print((char)message[i]);
    	messageTemp += (char)message[i];
  	}
  	Serial.println("'");

	if (topicStr == ("/" + MAC))
	{
		// TODO: Handle case
	}
	else if(topicStr == "/server/online")
	{
		// TODO: Let user know
		if (messageTemp != "connected" && messageTemp != "disconnected") 
			return;
		connectedWithNode = messageTemp == "connected";
	}
}
void reconnect() 
{

	if (client.connected()) return;
	
	// TODO: Get MAC Address as ID
	if (client.connect(MAC.c_str(), MQTTUSER, MQTTPASS)) {
		client.subscribe(("/" + MAC + "/#").c_str());
		client.subscribe("/server/online");

		// Sending device now available
		client.publish("/devices", MAC.c_str());
	} 
	else
	{
		Serial.print("failed, rc=");
      	Serial.println(client.state());
		delay(1000);
	}

}