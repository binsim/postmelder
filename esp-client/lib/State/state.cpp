#include "state.h"

void State::init()
{
	this->setupLEDs();
	this->setState(States::INIT, true);
}
void State::setupLEDs()
{
	pinMode(R_LED_PIN, OUTPUT);
	pinMode(G_LED_PIN, OUTPUT);
	pinMode(B_LED_PIN, OUTPUT);

	// PWM for blinking LEDs
	ledcSetup(R_LEDC_CHANEL, R_LEDC_FREQ, LEDC_RES_BITS);
	ledcSetup(B_LEDC_CHANEL, B_LEDC_FREQ, LEDC_RES_BITS);

	// Attach pins to channel
	ledcAttachPin(B_LED_PIN, B_LEDC_CHANEL);
	ledcAttachPin(R_LED_PIN, R_LEDC_CHANEL);
}

void State::setState(States state, bool isActive)
{
	switch (state)
	{
	case States::INIT:
		if (isActive)
		{
			if (this->isInit())
				return;
			this->c_currentState = 1 << 0;
		}
		else
		{
			if (!this->isInit())
				return;
			this->c_currentState &= ~(1 << 0);
		}
		break;

	case States::COMMUNICATION_ERR:
		if (isActive)
		{
			if (this->isCommunicationError())
				return;
			this->c_currentState |= 1 << 7;
		}
		else
		{
			if (!this->isCommunicationError())
				return;
			this->c_currentState &= ~(1 << 7);
		}
		break;

	case States::SCALE_ERR:
		if (isActive)
		{
			if (this->isScaleError())
				return;
			this->c_currentState |= 1 << 6;
		}
		else
		{
			if (!this->isScaleError())
				return;
			this->c_currentState &= ~(1 << 6);
		}
		break;

	case States::OCCUPIED:
		if (isActive)
		{
			if (this->isOccupied())
				return;
			this->c_currentState |= 1 << 1;
		}
		else
		{
			if (!this->isOccupied())
				return;
			this->c_currentState &= ~(1 << 1);
		}
		break;
	case States::SCALE_CALIBRATION:
		if (isActive)
		{
			if (this->isScaleCalibration())
				return;
			this->c_currentState |= 1 << 2;
		}
		else
		{
			if (!this->isScaleCalibration())
				return;
			this->c_currentState &= ~(1 << 2);
		}

	default:
		Serial.print("Entered state is not defined: ");
		Serial.println(state);
		break;
	}
	this->updateLEDs();

	Serial.print("State changed: ");
	Serial.println(this->c_currentState, HEX);
}

bool State::isInit()
{
	return this->c_currentState & 1 << 0;
}
bool State::isOccupied()
{
	return this->c_currentState & 1 << 1;
}
bool State::isCommunicationError()
{
	return this->c_currentState & 1 << 7;
}
bool State::isScaleError()
{
	return this->c_currentState & 1 << 6;
}
bool State::isScaleCalibration()
{
	return this->c_currentState & 1 << 2;
}
bool State::isError()
{
	return this->isCommunicationError() || this->isScaleError();
}

void State::loop()
{
	static byte init_counter = 0;
	if (this->isInit())
	{
		if (init_counter++ > 10)
		{
			this->setState(States::INIT, false);
		}
	}
}

void State::updateLEDs()
{
	if (this->isInit())
	{
		Serial.print("In Init");
		ledcWrite(R_LEDC_CHANEL, LEDC_OFF_DUTY);
		ledcWrite(B_LEDC_CHANEL, LEDC_ON_DUTY);
		digitalWrite(G_LED_PIN, LOW);
	}
	else if (this->isError())
	{
		Serial.print("In Error");
		ledcWrite(R_LEDC_CHANEL, LEDC_ON_DUTY);
		ledcWrite(B_LEDC_CHANEL, LEDC_OFF_DUTY);
		digitalWrite(G_LED_PIN, LOW);
	}
	else if (this->isScaleCalibration())
	{
		Serial.print("In Scale Calibration");
		ledcWrite(R_LEDC_CHANEL, LEDC_OFF_DUTY);
		ledcWrite(B_LEDC_CHANEL, LEDC_ON_DUTY);
		digitalWrite(G_LED_PIN, LOW);
	}
	else if (this->isOccupied())
	{
		Serial.print("In Occupied");
		ledcWrite(R_LEDC_CHANEL, LEDC_OFF_DUTY);
		ledcWrite(B_LEDC_CHANEL, LEDC_OFF_DUTY);
		digitalWrite(G_LED_PIN, HIGH);
	}
	else
	{
		Serial.print("In Empty");
		ledcWrite(R_LEDC_CHANEL, LEDC_OFF_DUTY);
		ledcWrite(B_LEDC_CHANEL, LEDC_OFF_DUTY);
		digitalWrite(G_LED_PIN, LOW);
	}
}
