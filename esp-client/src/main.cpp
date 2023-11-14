#define RLedPin 2
#define GLedPin 3
#define BLedPin 4

#include <Arduino.h>
#include <HCSR04.h>

// Abstandssensor
double *distances;
byte triggerPin = 13;
byte echoCount = 2;
byte *echoPins = new byte[echoCount]{12, 11};

float threshhold1; //-> Flash
float threshhold2; //-> Flash

float meanDistances[2];

bool ausgeloest = false;

void setup()
{
	pinMode(RLedPin, OUTPUT); // Pins initialisieren
	pinMode(GLedPin, OUTPUT);
	pinMode(BLedPin, OUTPUT);

	ledcSetup(0, 10, 12); // PWM für blaue LED
	ledcAttachPin(BLedPin, 0);

	ledcWrite(0, 100);	  // blaue LED blinken
	Serial.begin(115200); // Serielle USB-Verbindung für Debugging
	delay(100);

	HCSR04.begin(triggerPin, echoPins, echoCount); // Sensor starten

	calibrateEcho(); // Sensoren auf Fach kalibrieren

	ledcWrite(0, 100); // blaue LED aus
}

// calibrateEcho
void calibrateEcho()
{
	Serial.println("----------------");
	Serial.println("calibrateEcho()");

	measureMean(5); // Mittelwert aus 5 Messungen

	threshhold1 = meanDistances[0] * threshholdRatio; // mit threshholdRation multiplizieren
	threshhold2 = meanDistances[1] * threshholdRatio;

	Serial.print("Thresholds: ");
	Serial.print(threshhold1);
	Serial.print(", ");
	Serial.println(threshhold2);
	Serial.println("----------------");
}

// measureMean
void measureMean(int cycles)
{ // liest die Sensoren "cycles" mal aus und bildet den Mittelwert

	Serial.println("----------------");
	Serial.println("measureMean()");

	float mean1 = 0;
	float mean2 = 0;

	for (int i = 0; i < cycles; i++)
	{
		distances = HCSR04.measureDistanceCm();

		Serial.print("Messung ");
		Serial.print(i);
		Serial.print(": ");
		Serial.print(distances[0]);
		Serial.print(", ");
		Serial.print(distances[1]);
		Serial.print(", ");

		mean1 += distances[0];
		mean2 += distances[1];

		Serial.print("means: ");
		Serial.print(mean1);
		Serial.print(", ");
		Serial.println(mean2);
		delay(100);
	}

	mean1 /= cycles;
	mean2 /= cycles;

	meanDistances[0] = mean1;
	meanDistances[1] = mean2;

	mean1 = 0;
	mean2 = 0;

	Serial.print("Mittelwerte: ");
	Serial.print(meanDistances[0]);
	Serial.print(", ");
	Serial.println(meanDistances[1]);
	Serial.println("----------------");
}

// belegt
bool belegt()
{
	Serial.println("----------------");
	Serial.println("belegt()");

	measureMean(2); // Mittelwert aus 2 Messungen

	if (meanDistances[0] <= threshhold1 && meanDistances[1] <= threshhold2)
	{ // wenn beide unter Threshhold, dann auslösen
		Serial.println("BELEGT");
		Serial.println("----------------");
		return true;
	}
	else
	{
		Serial.println("NICHT BELEGT");
		Serial.println("----------------");
		return false;
	}
}

// geleert
bool geleert()
{ // stellt fest, ob das Postfach 1min lang leer war (Überprüfung ca. alle 20s -> 3x)
	static unsigned long zeit = 0;
	static int counter = 0;
	static int cycle = 0;

	Serial.println("----------------");
	Serial.println("geleert()");
	Serial.print("cycle ");
	Serial.println(cycle);

	if (zeit > millis()) // reset bei Overflow von millis()
	{
		zeit = millis();
	}

	if (cycle == 0)
	{
		zeit = millis(); // Zeit beim ersten Abruf speichern
		Serial.print("Zeit: ");
		Serial.println(zeit);

		cycle++;
	}

	if (millis() >= (zeit + cycle * 20000))
	{ // ca. alle 20s
		Serial.println("MESSEN");

		if (belegt())
		{ // wenn belegt, 1 hochzählen
			counter++;
		}
		cycle++;
	}

	Serial.print("counter: ");
	Serial.println(counter);

	if (counter == 0 && cycle == 3)
	{			   // wenn fertig durchgelaufen und nicht belegt
		cycle = 0; // von neuem anfangen
		return true;
	}
	else if (cycle == 3)
	{			   // wenn fertig durchgelaufen und belegt
		cycle = 0; // von neuem anfangen
		counter = 0;
		return false;
	}
	else
	{
		return false;
	}
}

// loop
void loop()
{
	if (!ausgeloest)
	{ // wenn ausgeloest, dann grüne LED an und publishen
		if (belegt())
		{
			ausgeloest = true;
			digitalWrite(GLedPin, HIGH);
		}
	}
	else if (geleert())
	{ // wenn wieder geleert, dann grüne LED aus und publishen

		ausgeloest = false;
		digitalWrite(GLedPin, LOW);
	}
}
