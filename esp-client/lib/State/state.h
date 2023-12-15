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
};

class State
{
public:
	void setupLEDs();

	void setState(States state, bool isActive);
	void loop();

private:
	bool isInit();
	bool isError();
	bool isCommunicationError();
	bool isScaleError();
	bool isOccupied();
	void updateLEDs();
	char c_currentState;
};

#endif