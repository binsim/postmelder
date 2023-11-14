import { MqttClient, connect } from 'mqtt';
import { Device, IDevice, loadFromFile, saveToFile } from './EspDevice';
import EventEmitter from 'node:events';

export declare interface IMQTTService {
	get devices(): IDevice[];
	get isConnected(): boolean;

	connect(): void;

	getDeviceByID(id: string): IDevice | undefined;
	updateDevice(device: IDevice): void;

	on(event: 'connectionChanged', callback: (value: boolean) => void): void;
	on(event: 'deviceAdded', callback: (device: IDevice) => void): void;
}
export class MQTTService extends EventEmitter implements IMQTTService {
	private _devices: IDevice[];
	private _client: MqttClient | undefined;
	private _deviceSaveToFileTimeout: NodeJS.Timeout | undefined = undefined;
	private _isConnected = false;

	constructor() {
		super();
		this._devices = loadFromFile();
	}

	private get client(): MqttClient {
		if (!this._client)
			throw new Error(
				'Client is not connected, please execute connect function first'
			);
		return this._client as MqttClient;
	}
	get devices() {
		return this._devices;
	}
	get isConnected() {
		return this._isConnected;
	}
	private set isConnected(value: boolean) {
		if (value === this._isConnected) return;

		this._isConnected = value;
		this.emit('connectionChanged', this._isConnected);
	}

	connect() {
		this._client = connect('mqtt://mqtt', {
			username: process.env.MQTT_USERNAME,
			password: process.env.MQTT_PASSWORD,
		});

		this._client.on('error', (err: Error) => {
			this.isConnected = false;
			// TODO: Handle Error
		});
		this._client.on('connect', () => {
			// Subscribe to get all devices
			this.client.subscribe('/devices');

			this.isConnected = true;
		});
		this._client.on('message', this.onMessageArrived);
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

		saveToFile(this.devices);
	}

	private onMessageArrived(topic: string, payload: Buffer) {
		if (topic === '/devices') {
			const id = payload.toString();

			// Subscribe to all topics for this device
			this.client.subscribe(`/${id}/#`);

			if (!this.getDeviceByID(id)) {
				this._devices.push(
					// Create new device with no information
					new Device({
						id,
						subscriber: [],
						notificationTitle: '',
						notificationBody: '',
					})
				);

				this.emit('deviceAdded', this._devices.at(-1) as IDevice);

				// Write to file after not adding a new device for 15 secs
				if (this._deviceSaveToFileTimeout)
					clearTimeout(this._deviceSaveToFileTimeout);
				this._deviceSaveToFileTimeout = setTimeout(() => {
					saveToFile(this._devices);
				}, 15_000);
			}

			// Respond to client to let it know it has been registered
			this.client.publish(`/${id}`, '');
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
