#ifndef STATE_H
#define STATE_H

#include <Arduino.h>
#include "configuration.h"

enum States
{
	INIT,
	OCCUPIED,
	COMMUNICATION_ERR,
	SCALE_ERR,
	SCALE_CALIBRATION
};

class State
{
public:
	void init();

	void setState(States state, bool isActive);
	void loop();

private:
	bool isInit();
	bool isError();
	bool isCommunicationError();
	bool isScaleError();
	bool isOccupied();
	bool isScaleCalibration();
	void setupLEDs();
	void updateLEDs();
	char c_currentState;
};

#endif