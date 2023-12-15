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
	bool isInit();
	void loop();

private:
	bool isError();
	bool isCommunicationError();
	bool isScaleError();
	bool isOccupied();
	void updateLEDs();
	char c_currentState;
};

#endif