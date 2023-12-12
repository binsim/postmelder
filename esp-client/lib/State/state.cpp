#include "state.h"

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
			this->c_currentState = 1 << 0;
		else
			this->c_currentState &= ~(1 << 0);
		break;

	case States::COMMUNICATION_ERR:
		if (isActive)
			this->c_currentState |= 1 << 7;
		else
			this->c_currentState &= ~(1 << 7);
		break;

	case States::SCALE_ERR:
		if (isActive)
			this->c_currentState |= 1 << 6;
		else
			this->c_currentState &= ~(1 << 6);
		break;

	case States::OCCUPIED:
		if (isActive)
			this->c_currentState |= 1 << 1;
		else
			this->c_currentState &= ~(1 << 1);
		break;

	default:
		Serial.print("Entered state is not defined: ");
		Serial.println(state);
		break;
	}
	// TODO: Update lights
}

bool State::isInit()
{
	return !!this->c_currentState & 1 << 0;
}
bool State::isOccupied()
{
	return !!this->c_currentState & 1 << 1;
}
bool State::isCommunicationError()
{
	return !!this->c_currentState & 1 << 7;
}
bool State::isScaleError()
{
	return !!this->c_currentState & 1 << 6;
}
bool State::isError()
{
	return this->isCommunicationError() | this->isScaleError();
}

void State::loop()
{
	this->updateLEDs();
}

void State::updateLEDs()
{
	if (this->isError())
	{
		ledcWrite(R_LEDC_CHANEL, LEDC_ON_DUTY);
		ledcWrite(B_LEDC_CHANEL, LEDC_OFF_DUTY);
		digitalWrite(G_LED_PIN, LOW);
	}
	else if (this->isInit())
	{
		ledcWrite(R_LEDC_CHANEL, LEDC_OFF_DUTY);
		ledcWrite(B_LEDC_CHANEL, LEDC_ON_DUTY);
		digitalWrite(G_LED_PIN, LOW);
	}
	else if (this->isOccupied())
	{
		ledcWrite(R_LEDC_CHANEL, LEDC_OFF_DUTY);
		ledcWrite(B_LEDC_CHANEL, LEDC_OFF_DUTY);
		digitalWrite(G_LED_PIN, HIGH);
	}
	else
	{
		ledcWrite(R_LEDC_CHANEL, LEDC_OFF_DUTY);
		ledcWrite(B_LEDC_CHANEL, LEDC_OFF_DUTY);
		digitalWrite(G_LED_PIN, LOW);
	}
	this->updateLEDs();
}
