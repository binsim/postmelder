#include "Scale.h"

#ifdef WIPE
void Scale::wipeFlash()
{
	nvs_flash_erase();
	nvs_flash_init();
}
#endif

void Scale::init()
{
	preferences.begin("postmelder", true);				// start preferences
	this->scale.begin(SCALE_DATA_PIN, SCALE_CLOCK_PIN); // start scale

	this->initialised = preferences.getBool("initialised"); // read flag from flash
	if (this->initialised)
	{
		Serial.println("already initialised, loading values...");

		this->factor = preferences.getFloat("scaleValue", 0); // read values from flash
		this->offset = preferences.getLong("scaleOffset", 0);

		scale.set_offset(this->offset); // set scale values
		scale.set_scale(this->factor);

		// Print to serial monitor
		Serial.print("ScaleValue: "); // print them to the serial monitor
		Serial.print(this->factor);
		Serial.print(", ScaleOffset: ");
		Serial.println(this->offset);

		// Initial reading to discard any weird measurements
		this->readWeight();
	}
	else
		Serial.println("not yet initialised, start manual calibration!");

	preferences.end(); // close preferences
}

float Scale::calibrateScaleOffset()
{
	// FIXME: Don't apply changes to scale yet
	Serial.println("calculating scaleOffset");
	scale.tare(20); // mean of 20 measurements
	float offset = scale.get_offset();

	Serial.print("scaleOffset: ");
	Serial.println(offset);
	Serial.println();

	this->offset = offset;

	return offset;
}
float Scale::calibrateScaleFactor(unsigned int grams)
{
	// FIXME: Don't apply changes to scale yet
	Serial.println("calculating scale conversion factor...");

	scale.calibrate_scale(grams, 20);
	float factor = scale.get_scale();

	// print result to serial monitor
	Serial.print("conversion factor: ");
	Serial.println(factor);

	this->factor = factor;

	return factor;
}
void Scale::saveScaleValues()
{
	this->initialised = this->offset && this->factor;

	// TODO: Apply Scale changes

	preferences.begin("postmelder", false); // start preferences

	preferences.putFloat("scaleValue", this->factor); // save values to flash
	preferences.putLong("scaleOffset", this->offset);
	preferences.putBool("initialised", this->initialised);

	preferences.end(); // close preferences
}
void Scale::cancelCalibration()
{
	preferences.begin("postmelder", true); // start preferences

	this->factor = preferences.getFloat("scaleValue", 0); // read values from flash
	this->offset = preferences.getLong("scaleOffset", 0);
	this->initialised = preferences.getBool("initialised"); // read flag from flash

	preferences.end();
}

float Scale::readWeight()
{
	return this->scale.get_units(20);
}

float Scale::getCurrentWeight()
{
	return this->weight;
}
bool Scale::weightChanged()
{
	// FIXME: It does not get detected when no scale is connected
	if (!this->scale.is_ready())
		return false;

	float newWeight = this->readWeight();
	if (!(newWeight >= this->weight + SCALE_THRESHOLD || newWeight <= this->weight - SCALE_THRESHOLD))
		return false;

	// New weight is out of threshold
	this->weight = newWeight;

	// Print to serial monitor
	Serial.print("Change detected, weight: ");
	Serial.print(weight, 1);
	Serial.println("g");

	return true;
}