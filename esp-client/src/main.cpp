#include <Arduino.h>
#include <WiFi.h>

#define SSID "Postmelder-Wifi"

WiFiClient wiFiClient;

void setup() 
{
	Serial.begin(115200);

	// Connect to WiFi
	Serial.print("Connect to: ");
	Serial.println(SSID);
	WiFi.begin(SSID);

}

void loop() 
{
	if (WiFi.status() != WL_CONNECTED) 
	{
		// TODO: Show Output RGB
	}

}