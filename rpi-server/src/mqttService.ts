import { connect } from 'mqtt';
import { Device, IDevice, loadFromFile, saveToFile } from './EspDevice';

let devices: IDevice[] = loadFromFile();
let client = connect('mqtt://mqtt', {
	username: process.env.MQTT_USERNAME,
	password: process.env.MQTT_PASSWORD,
});

client.on('error', (err: Error) => {
	console.error(`ERR: ${err.message}`);
});

client.on('connect', () => {
	client.subscribe('/devices');
});

let _deviceSaveToFileTimeout: NodeJS.Timeout;
client.on('message', (topic: string, payload: Buffer) => {
	if (topic === '/devices') {
		const id = payload.toString();

		client.subscribe(`/${id}/#`);

		if (getDeviceById(id)) {
			devices.push(new Device(id));

			// Write to file after not adding a new device for 15 secs
			if (_deviceSaveToFileTimeout)
				clearTimeout(_deviceSaveToFileTimeout);
			_deviceSaveToFileTimeout = setTimeout(() => {
				saveToFile(devices);
			}, 15_000);
		}

		// Respond to client to let it know it has been registered
		client.publish(`/${id}`, '');
		return;
	}

	const firstTopic = topic.split('/')[1];
	const device = getDeviceById(firstTopic);

	if (device) {
		(device as Device)._onMessageArrived(topic, payload);
	} else {
		console.error(`Topic '${topic}' is not yet implemented`);
	}
});

export function getDevices(): IDevice[] {
	return devices;
}
export function getDeviceById(id: string): IDevice | undefined {
	return devices.filter((device: IDevice) => device.id === id).at(0);
}
export function updateDevice(device: IDevice) {
	const index = devices.findIndex((element) => element.id === device.id);

	// TODO: Check if item should be added or throw an error if it does not exist
	if (index < 0) {
		devices.push(device);
	} else {
		devices[index] = device;
	}
}
