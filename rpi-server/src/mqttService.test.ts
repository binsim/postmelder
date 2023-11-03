import { test, describe, expect } from '@jest/globals';
import { MQTTService } from './mqttService';
import { MqttClient } from 'mqtt/*';

jest.useFakeTimers();

describe('MQTTService', () => {
	const service = new MQTTService();
	while (service.devices.pop()) {}
	(service as any)._client = {
		publish: function (topic: string, message: string) {},
		subscribe: function (topic: string) {},
	} as MqttClient;

	const deviceID = 'ID:1234';

	test('Connect new device', () => {
		(service as any).onMessageArrived('/devices', Buffer.from(deviceID));

		jest.runAllTimers();

		expect(service.devices.at(-1)?.id).toBe(deviceID);
	});

	test('Device online message', () => {
		const device = service.getDeviceByID(deviceID);

		let isOnline = false;

		device?.onOnlineChanged((value) => (isOnline = value));
		(service as any).onMessageArrived(`/${deviceID}/online`, 'online');

		expect(isOnline).toBe(true);
		expect(device?.isOnline).toBe(true);
	});
	test('Device offline message', () => {
		const device = service.getDeviceByID(deviceID);

		let isOnline = true;

		device?.onOnlineChanged((value) => (isOnline = value));
		(service as any).onMessageArrived(`/${deviceID}/online`, 'offline');

		expect(isOnline).toBe(false);
		expect(device?.isOnline).toBe(false);
	});
	test('Wrong online Message', () => {
		const device = service.getDeviceByID(deviceID);
		// Execute this to trigger onOnlineChanged for wrong message
		(service as any).onMessageArrived(`/${deviceID}/online`, 'online');

		let isOnline = true;

		device?.onOnlineChanged((value) => (isOnline = value));
		(service as any).onMessageArrived(`/${deviceID}/online`, 'Wrong');

		expect(isOnline).toBe(false);
		expect(device?.isOnline).toBe(false);
	});

	test('Device occupied message', () => {
		const device = service.getDeviceByID(deviceID);

		let isOccupied = false;

		device?.onOccupiedChanged((value) => (isOccupied = value));
		(service as any).onMessageArrived(`/${deviceID}/status`, 'occupied');

		expect(isOccupied).toBe(true);
		expect(device?.isOccupied).toBe(true);
	});
	test('Device free message', () => {
		const device = service.getDeviceByID(deviceID);

		let isOccupied = true;

		device?.onOccupiedChanged((value) => (isOccupied = value));
		(service as any).onMessageArrived(`/${deviceID}/status`, 'free');

		expect(isOccupied).toBe(false);
		expect(device?.isOccupied).toBe(false);
	});
	test('Wrong status Message', () => {
		const device = service.getDeviceByID(deviceID);

		let isOccupied = false;

		device?.onOccupiedChanged((value) => (isOccupied = value));
		(service as any).onMessageArrived(`/${deviceID}/status`, 'Wrong');

		expect(isOccupied).toBe(true);
		expect(device?.isOccupied).toBe(true);
	});
});
