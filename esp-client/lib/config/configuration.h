#ifndef L_CONFIG_H
#define L_CONFIG_H

#include <Arduino.h>

// Include following to wipe the memory
// #define WIPE

// ----------------------- MQTT-Server Settings ---------------------  //
#define SSID "Postmelder-Wifi"
#define SERVER_IP 10, 42, 0, 1
#define MQTT_USER "MQTTBroker"
#define MQTT_PASS "postmelder"

// -----------------------  Scale Settings --------------------------  //
#define SCALE_THRESHOLD 2 // value in grams, above or below which no change will be reported in grams
#define SCALE_FINE_THRESHOLD 0.2

#define OCCUPIED_THRESHOLD 1 // value in grams, above which the scale will be considered occupied

#define SCALE_DATA_PIN 32
#define SCALE_CLOCK_PIN 33

#define SCALE_WAIT_TIME 3000 // time in ms how long the scale waits after a weight change to report final weight
#define SCALE_ERROR_HOPS 50  // number of measurements within which the weight has to settle in; othwise an error will be thrown (high number to not mistakenly throw an error)

#define SCALE_SAMPLE_COUNT 50 // number of measurements to take for calibration and final measurement, use bigger value >40 to work with less precise loadcells

// -----------------------  State Settings --------------------------- //
#define R_LED_PIN 0
#define G_LED_PIN 2
#define B_LED_PIN 15
#define B_LEDC_CHANEL 0
#define R_LEDC_CHANEL 1
#define B_LEDC_FREQ 1
#define R_LEDC_FREQ 1
#define LEDC_RES_BITS 12
#define LEDC_ON_DUTY 100
#define LEDC_OFF_DUTY 0

#endif // L_CONFIG_H