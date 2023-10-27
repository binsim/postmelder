#include <HCSR04.h>

byte triggerPin = 3;
byte echoCount = 2;
byte* echoPins = new byte[echoCount]{ 4, 5 };

void setup() {
  Serial.begin(9600);
  HCSR04.begin(triggerPin, echoPins, echoCount);
}

void loop() {
  double* distances = HCSR04.measureDistanceCm();

  Serial.print("1:");
  Serial.print(distances[0]);
  Serial.print(", 2:");
  Serial.println(distances[1]);


  delay(100);
}