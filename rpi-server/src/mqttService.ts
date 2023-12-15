import { MqttClient, connect } from 'mqtt';
import { Device, IDevice, loadFromFile, saveToFile } from './EspDevice';
import EventEmitter from 'node:events';
import { logger } from './logging';

export declare interface IMQTTService {
	/**
	 * Detected devices by mqtt service
	 */
	get devices(): IDevice[];
	/**
	 * Online state of mqtt service
	 */
	get isConnected(): boolean;

	/**
	 * Connect to mqtt broker
	 * This must be called for mqtt service to work
	 */
	connect(): void;

	/**
	 * get a device by entered id
	 *
	 * @param id The id of the requested device
	 * @returns The device with entered id or undefined
	 */
	getDeviceByID(id: string): IDevice | undefined;
	/**
	 * Apply a update for entered device
	 *
	 * @param device new device information
	 */
	updateDevice(device: IDevice): void;

	publish(topic: string, payload: Buffer): void;

	// Subscribing to events
	// No need to unsubscribe to thous events, because they are called once in main
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
		// Emit event online changed to update state LEDs
		this.emit('connectionChanged', this._isConnected);
		// This is a critical information thus it gets logged
		if (this._isConnected) {
			logger.info('MQTT connection successfully established');
		} else {
			logger.warn('MQTT connection lost');
		}
	}

	connect() {
		// No need to connect if already connected
		if (this.isConnected) {
			logger.warn(
				'Tried to reconnect ot mqtt broker. This method should only be called once'
			);
			return;
		}

		// connect to mqtt
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
			// TODO: Incase of local execution docker is not running and errors are constantly loged
			// 		 catch same errors after printing it a x-th time and print it again rarely

			// TODO: Handle Error
			logger.error(`MQTT Client error: ${err.message}`);
		});
		this._client.on('connect', () => {
			this.isConnected = true;
			// Subscribe to get all devices
			this.client.subscribe('/devices');
			logger.info(`Subscribing to '/devices'`);

			// Publish to trigger devices to send needed information that have no retain flag
			this.client.publish('/server/online', Buffer.from('connected'), {
				retain: true,
			});

			// Contact already added devices
			this.devices.forEach((device) => {
				this.client.subscribe(`/${device.id}/#`);
				logger.info(`Subscribing to '/${device.id}/#`);
				this.emit('deviceAdded', device);
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
		const index = this._devices.findIndex((d) => d.id === device.id);

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

		this.saveToFile();
	}
	public publish(topic: string, payload: Buffer): void {
		this.client.publish(topic, payload);
	}

	private saveToFile() {
		// Write to file after not adding a new device for 15 secs
		// to reduce writing to much or damaging the file
		if (this._deviceSaveToFileTimeout)
			clearTimeout(this._deviceSaveToFileTimeout);
		this._deviceSaveToFileTimeout = setTimeout(() => {
			saveToFile(this._devices);
		}, 15_000);
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

				this.saveToFile();
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
			try {
				(device as Device)._onMessageArrived(
					topic.split('/').slice(2).join('/'),
					payload
				);
				return;
			} catch (error) {
				// Only return if message handled correctly
				logger.warn(error);
			}
		}

		// Topic is not for an existing device
		logger.error(`Topic '${topic}' is not yet implemented`);
	}
}
