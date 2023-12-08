import { test, describe, expect } from '@jest/globals';
import { MQTTService } from './mqttService';
import { MqttClient } from 'mqtt/*';
import { IDevice, saveToFile } from './EspDevice';
import { logger } from './logging';

jest.useFakeTimers();

describe('MQTTService', () => {
	// publish and subscribe isn't working if not connected to mqtt broker and is not needed for testing
	(MQTTService.Instance as any)._client = {
		publish: function (_topic: string, _message: string) {},
		subscribe: function (_topic: string) {},
	} as MqttClient;

	// ID that is used for executing following tests
	const deviceID = 'ID:1234';

	test('Connect new device', () => {
		let newDevice: IDevice | undefined;

		// Listen on event for the new device
		MQTTService.Instance.on(
			'deviceAdded',
			(device) => (newDevice = device)
		);

		// Check if device has not been added yet
		expect(
			MQTTService.Instance.devices
				.filter((device) => device.id === deviceID)
				.at(0)
		).toBe(undefined);

		// Send mqtt message to add new device
		(MQTTService.Instance as any).onMessageArrived(
			'/devices',
			Buffer.from(deviceID)
		);

		jest.runAllTimers();

		// Check event to be executed correctly
		expect(newDevice?.id).toBe(deviceID);
		// Check if device has been added to array
		expect(MQTTService.Instance.devices.at(-1)?.id).toBe(deviceID);
	});

	test('Device online message', () => {
		const device = MQTTService.Instance.getDeviceByID(deviceID);

		let isOnline = false;

		// Listen to event
		device?.on('onlineChanged', (value) => (isOnline = value));
		// Sending mqtt message
		(MQTTService.Instance as any).onMessageArrived(
			`/${deviceID}/online`,
			'connected'
		);

		expect(isOnline).toBe(true);
		expect(device?.isOnline).toBe(true);
	});
	test('Device offline message', () => {
		const device = MQTTService.Instance.getDeviceByID(deviceID);

		let isOnline = true;

		// Listen to event
		device?.on('onlineChanged', (value) => (isOnline = value));
		// Sending mqtt message
		(MQTTService.Instance as any).onMessageArrived(
			`/${deviceID}/online`,
			'disconnected'
		);

		expect(isOnline).toBe(false);
		expect(device?.isOnline).toBe(false);
	});
	test('Wrong online Message', () => {
		const device = MQTTService.Instance.getDeviceByID(deviceID);
		(device as any).isOnline = true;

		let isOnline = true;
		logger.warn = jest.fn();

		// Listen to event
		device?.on('onlineChanged', (value) => (isOnline = value));
		// Sending mqtt message
		(MQTTService.Instance as any).onMessageArrived(
			`/${deviceID}/online`,
			'Wrong'
		);

		expect(isOnline).toBe(false);
		expect(device?.isOnline).toBe(false);
		// This case should be logged to the user
		expect(logger.warn).toBeCalled();
	});

	test('Object added to office box', () => {
		const device = MQTTService.Instance.getDeviceByID(deviceID);
		const testWeight = 50;

		let isOccupied = false;
		expect(device?.isOccupied).toBe(false);

		// Listen to event
		device?.on('occupiedChanged', (value) => (isOccupied = value));
		// Sending mqtt message
		(MQTTService.Instance as any).onMessageArrived(
			`/${deviceID}/currentWeight`,
			testWeight
		);

		expect(isOccupied).toBe(true);
		expect(device?.isOccupied).toBe(true);
		expect(device?.currentWeight).toBe(testWeight);
		expect(device?.history.at(-1)?.weight).toBe(testWeight);
	});
	test('Office box cleared', () => {
		const device = MQTTService.Instance.getDeviceByID(deviceID);

		let isOccupied = true;
		expect(device?.isOccupied).toBe(true);

		// Listen to event
		device?.on('occupiedChanged', (value) => (isOccupied = value));
		// Sending mqtt message
		(MQTTService.Instance as any).onMessageArrived(
			`/${deviceID}/currentWeight`,
			0
		);

		expect(isOccupied).toBe(false);
		expect(device?.isOccupied).toBe(false);
		expect(device?.currentWeight).toBe(0);
		expect(device?.history.length).toBe(0);
	});

	test('Calibrate first step', async () => {
		const device = MQTTService.Instance.getDeviceByID(deviceID);
		(device as any).isOnline = true;

		const func = device?.calcScaleOffset();

		(MQTTService.Instance as any).onMessageArrived(
			`/${deviceID}/calibration/scaleOffset`,
			Buffer.from('20')
		);

		expect(await func).toBe(20);
	});
	test('Calibrate second step', async () => {
		const device = MQTTService.Instance.getDeviceByID(deviceID);
		(device as any).isOnline = true;

		const func = device?.calcScaleWeight(100);

		(MQTTService.Instance as any).onMessageArrived(
			`/${deviceID}/calibration/scaleValue`,
			Buffer.from('200')
		);

		expect(await func).toBe(200);
	});

	function removeTestDevice() {
		// remove device from locally saved array
		MQTTService.Instance.devices.splice(
			MQTTService.Instance.devices.findIndex((i) => i.id === deviceID),
			1
		);

		// remove device from config file
		saveToFile(MQTTService.Instance.devices);
	}

	// Cleanup after executing all tests
	afterAll(() => {
		removeTestDevice();
	});
	// Remove test device incase it exists
	beforeAll(() => {
		removeTestDevice();
	});
});
