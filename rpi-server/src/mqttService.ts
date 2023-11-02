import { MqttClient, connect } from 'mqtt';
import { Device, IDevice, loadFromFile, saveToFile } from './EspDevice';

export interface IMQTTService {
	get devices(): IDevice[];

	getDeviceByID(id: string): IDevice | undefined;
	updateDevice(device: IDevice): void;
}
export class MQTTService implements IMQTTService {
	private _devices: IDevice[];
	private _client: MqttClient;
	private _deviceSaveToFileTimeout: NodeJS.Timeout | undefined = undefined;

	constructor() {
		this._devices = loadFromFile();
		this._client = connect('mqtt://mqtt', {
			username: process.env.MQTT_USERNAME,
			password: process.env.MQTT_PASSWORD,
		});

		this._client.on('error', (err: Error) => {
			// TODO: Handle Error
		});
		this._client.on('connect', () => {
			// Subscribe to get all devices
			this._client.subscribe('/devices');
		});
		this._client.on('message', this.onMessageArrived);
	}

	get devices() {
		return this._devices;
	}

	getDeviceByID(id: string): IDevice | undefined {
		return this._devices
			.filter((device: IDevice) => device.id === id)
			.at(0);
	}
	updateDevice(device: IDevice) {
		const index = this._devices.findIndex(
			(device) => device.id === device.id
		);

		// TODO: Check if item should be added or throw an error if it does not exist
		if (index < 0) {
			this._devices.push(device);
		} else {
			this._devices[index] = device;
		}
	}

	private onMessageArrived(topic: string, payload: Buffer) {
		if (topic === '/devices') {
			const id = payload.toString();

			// Subscribe to all topics for this device
			this._client.subscribe(`/${id}/#`);

			if (this.getDeviceByID(id)) {
				this._devices.push(new Device(id));

				// Write to file after not adding a new device for 15 secs
				if (this._deviceSaveToFileTimeout)
					clearTimeout(this._deviceSaveToFileTimeout);
				this._deviceSaveToFileTimeout = setTimeout(() => {
					saveToFile(this._devices);
				}, 15_000);
			}

			// Respond to client to let it know it has been registered
			this._client.publish(`/${id}`, '');
			return;
		}

		const firstTopic = topic.split('/')[1];
		const device = this.getDeviceByID(firstTopic);

		if (device) {
			(device as Device)._onMessageArrived(topic, payload);
		} else {
			console.error(`Topic '${topic}' is not yet implemented`);
		}
	}
}
