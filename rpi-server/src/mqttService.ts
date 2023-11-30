import { MqttClient, connect } from 'mqtt';
import { Device, IDevice, loadFromFile, saveToFile } from './EspDevice';
import EventEmitter from 'node:events';
import { logger } from './logging';

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
	private static _instance: MQTTService;

	private constructor() {
		super();
		this._devices = loadFromFile();
	}
	static get Instance() {
		if (this._instance === undefined) this._instance = new MQTTService();

		return this._instance;
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
		if (this._isConnected) {
			logger.info('MQTT connection successfully established');
		} else {
			logger.warn('MQTT connection lost');
		}
	}

	connect() {
		this._client = connect('mqtt://mqtt', {
			username: process.env.MQTT_USERNAME,
			password: process.env.MQTT_PASSWORD,
			will: {
				topic: '/server/online',
				payload: Buffer.from('disconnected'),
				retain: true,
			},
		});

		this._client.on('error', (err: Error) => {
			this.isConnected = false;
			// TODO: Handle Error
			logger.error(`MQTT Client error: ${err.message}`);
		});
		this._client.on('connect', () => {
			this.isConnected = true;
			// Subscribe to get all devices
			this.client.subscribe('/devices');
			logger.info(`Subscribing to '/devices'`);

			this.client.publish('/server/online', Buffer.from('connected'), {
				retain: true,
			});
		});
		this._client.on('message', (topic: string, payload: Buffer) =>
			this.onMessageArrived(topic, payload)
		);
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
			logger.error(
				`${device.id} not found, it will be added automatically`
			);
			this._devices.push(device);
		} else {
			logger.info(`Successfully updated ${device.id}`);
			this._devices[index] = device;
		}

		saveToFile(this.devices);
	}

	private onMessageArrived(topic: string, payload: Buffer) {
		// Connecting new device
		if (topic === '/devices') {
			const id = payload.toString();

			// Subscribe to all topics for this device
			this.client.subscribe(`/${id}/#`);
			logger.info(`Subscribing to '/${id}/#`);

			if (!this.getDeviceByID(id)) {
				// Create new device with no information
				const device = new Device({
					id,
					subscriber: [],
					history: [],
				});

				this._devices.push(device);
				this.emit('deviceAdded', device);
				logger.info(`MQTTService found new device: ${device.id}`);

				// Write to file after not adding a new device for 15 secs
				if (this._deviceSaveToFileTimeout)
					clearTimeout(this._deviceSaveToFileTimeout);
				this._deviceSaveToFileTimeout = setTimeout(() => {
					saveToFile(this._devices);
				}, 15_000);
			}

			// Respond to client to let it know it has been registered
			this.client.publish(`/${id}`, '');
			logger.info(`Publish -t '/${id}' -m ''`);
			return;
		}
		// Get device
		const firstTopic = topic.split('/')[1];
		const device = this.getDeviceByID(firstTopic);

		if (device) {
			(device as Device)._onMessageArrived(topic, payload);
			return;
		}

		// Topic is not for an existing device
		logger.error(`Topic '${topic}' is not yet implemented`);
	}
}
