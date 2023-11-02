import { test, describe, expect } from '@jest/globals';
import { MQTTService } from './mqttService';
import { MqttClient } from 'mqtt/*';

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

		expect(service.devices.at(-1)?.id).toBe(deviceID);
	});
});
