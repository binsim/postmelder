#ifndef SCALE_H
#define SCALE_H

#include "configuration.h"
#include <HX711.h>
#include <Preferences.h>

#ifdef WIPE
#include <nvs_flash.h>
#endif // WIPE

class Scale
{
public:
	void init();

	bool weightChanged();
	float getCurrentWeight();

	// Calibration Functions
	float calibrateScaleOffset();
	float calibrateScaleFactor(unsigned int grams);
	void saveScaleValues();
	void cancelCalibration();

	//Scale error check
	bool isScaleError();

#ifdef WIPE
	void wipeFlash();
#endif // WIPE

private:
	HX711 scale;
	Preferences preferences;

	float offset;
	float factor;
	bool initialised;

	float weight;
	float readWeight();

	unsigned int hops;
};

#endif // SCALE_H