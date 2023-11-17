import { test, describe, expect } from '@jest/globals';
import { IMQTTService, MQTTService } from './mqttService';
import { MqttClient } from 'mqtt/*';
import { IDevice } from './EspDevice';

jest.useFakeTimers();

describe('MQTTService', () => {
	const service: IMQTTService = new MQTTService();
	while (service.devices.pop()) {}
	(service as any)._client = {
		publish: function (topic: string, message: string) {},
		subscribe: function (topic: string) {},
	} as MqttClient;

	const deviceID = 'ID:1234';

	test('Connect new device', () => {
		let newDevice: IDevice | undefined;

		service.on('deviceAdded', (device) => (newDevice = device));

		(service as any).onMessageArrived('/devices', Buffer.from(deviceID));

		jest.runAllTimers();

		expect(newDevice?.id).toBe(deviceID);
		expect(service.devices.at(-1)?.id).toBe(deviceID);
	});

	test('Device online message', () => {
		const device = service.getDeviceByID(deviceID);

		let isOnline = false;

		device?.on('onlineChanged', (value) => (isOnline = value));
		(service as any).onMessageArrived(`/${deviceID}/online`, 'online');

		expect(isOnline).toBe(true);
		expect(device?.isOnline).toBe(true);
	});
	test('Device offline message', () => {
		const device = service.getDeviceByID(deviceID);

		let isOnline = true;

		device?.on('onlineChanged', (value) => (isOnline = value));
		(service as any).onMessageArrived(`/${deviceID}/online`, 'offline');

		expect(isOnline).toBe(false);
		expect(device?.isOnline).toBe(false);
	});
	test('Wrong online Message', () => {
		const device = service.getDeviceByID(deviceID);
		// Execute this to trigger onOnlineChanged for wrong message
		(service as any).onMessageArrived(`/${deviceID}/online`, 'online');

		let isOnline = true;

		device?.on('onlineChanged', (value) => (isOnline = value));
		(service as any).onMessageArrived(`/${deviceID}/online`, 'Wrong');

		expect(isOnline).toBe(false);
		expect(device?.isOnline).toBe(false);
	});

	test('Object added to office box', () => {
		const device = service.getDeviceByID(deviceID);
		const testWeight = 50;

		let isOccupied = false;
		expect(device?.isOccupied).toBe(false);

		device?.on('occupiedChanged', (value) => (isOccupied = value));
		(service as any).onMessageArrived(
			`/${deviceID}/currentWeight`,
			testWeight
		);

		expect(isOccupied).toBe(true);
		expect(device?.isOccupied).toBe(true);
		expect(device?.currentWeight).toBe(testWeight);
		expect(device?.history.at(-1)?.weight).toBe(testWeight);
	});
	test('Office box cleared', () => {
		const device = service.getDeviceByID(deviceID);

		let isOccupied = true;
		expect(device?.isOccupied).toBe(true);

		device?.on('occupiedChanged', (value) => (isOccupied = value));
		(service as any).onMessageArrived(`/${deviceID}/currentWeight`, 0);

		expect(isOccupied).toBe(false);
		expect(device?.isOccupied).toBe(false);
		expect(device?.currentWeight).toBe(0);
		expect(device?.history.length).toBe(0);
	});

	// test('Device free message', () => {
	// 	const device = service.getDeviceByID(deviceID);

	// 	let isOccupied = true;

	// 	device?.on('occupiedChanged', (value) => (isOccupied = value));
	// 	(service as any).onMessageArrived(`/${deviceID}/status`, 'free');

	// 	expect(isOccupied).toBe(false);
	// 	expect(device?.isOccupied).toBe(false);
	// });
	// test('Wrong status Message', () => {
	// 	const device = service.getDeviceByID(deviceID);

	// 	let isOccupied = false;

	// 	device?.on('occupiedChanged', (value) => (isOccupied = value));
	// 	(service as any).onMessageArrived(`/${deviceID}/status`, 'Wrong');

	// 	expect(isOccupied).toBe(true);
	// 	expect(device?.isOccupied).toBe(true);
	// });
});
