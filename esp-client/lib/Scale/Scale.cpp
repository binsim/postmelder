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
	// Changes are directly applied to the scale

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
	// Changes are directly applied to the scale
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

	// Changes get applied during the other calibrate steps
	// These values get saved to the memory

	preferences.begin("postmelder", false); // start preferences

	// Change values if they have changed
	if (preferences.getFloat("scaleValue", 0) != this->factor)
		preferences.putFloat("scaleValue", this->factor);
	if (preferences.getLong("scaleOffset") != this->offset)
		preferences.putLong("scaleOffset", this->offset);
	if (preferences.getBool("initialised") != this->initialised)
		preferences.putBool("initialised", this->initialised);

	preferences.end(); // close preferences
}
void Scale::cancelCalibration()
{
	// Get values from before calibration
	preferences.begin("postmelder", true);

	this->factor = preferences.getFloat("scaleValue", 0);
	this->offset = preferences.getLong("scaleOffset", 0);
	this->initialised = preferences.getBool("initialised");

	preferences.end();

	if (this->initialised)
	{
		// Reset values
		scale.set_offset(this->offset);
		scale.set_scale(this->factor);
	}
	else
	{
		// TODO: Handle case
	}
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
	static unsigned long time;
	static bool printed;
	float dynamicThreshold;

	// if (!this->scale.is_ready()) // quit if scale is not ready
	// return false;

	float newWeight = this->readWeight(); // read current weight from scale

	if (hops == 0) // adjust scale threshold depending on whether the scale is in the process of settling in or not
	{
		dynamicThreshold = SCALE_THRESHOLD;
	}
	else
	{
		dynamicThreshold = SCALE_FINE_THRESHOLD;
	}

	if ((newWeight >= this->weight + dynamicThreshold || newWeight <= this->weight - dynamicThreshold)) // if significant weight change has been detected
	{
		this->weight = newWeight; // save new weight into old weight

		time = millis(); // restart timer

		printed = false; // enable MQTT publishing

		Serial.print("weight change detected: "); // print to serial monitor
		Serial.print(this->weight);
		Serial.println("g");

		if (hops <= SCALE_ERROR_HOPS) // to prevent int overflow
		{
			hops++; // increase counter
		}
	}

	if ((time + SCALE_WAIT_TIME) <= millis() && !printed) // if timer has run out (no weight change in the last x seconds)
	{
		hops = 0; // reset counter

		Serial.print("final weight: "); // print to serial monitor
		Serial.print(this->weight);
		Serial.println("g");

		printed = true; // disable MQTT publishing once published
		return true;
	}
	else
	{
		return false;
	}
}

bool Scale::isScaleError() // reports true when the scale is probably misfunctioning
{
	return (hops >= SCALE_ERROR_HOPS);
}