import EventEmitter from 'node:events';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { MQTTService } from './mqttService';
import { logger } from './logging';

const CONFIG_FILE = 'data/esp-clients.json';
export const NOTIFICATION_DEFAULT_TITLE =
	'Ihr Postfach mit der Nummer {BOXNR} ist belegt';
export const NOTIFICATION_DEFAULT_BODY =
	'Aktuelles Gewicht: {WEIGHT}g\nLetzte Leerung: {LASTEMPTIED}\nHistorie: {HISTORY}';

export const CheckIntervals = [
	'immediately',
	'hourly',
	'daily',
	'weekly',
] as const;
export type CheckInterval = (typeof CheckIntervals)[number];

export type HistoryType = { timeStamp: number; weight: number };

/**
 * Device information saved to the CONFIG_FILE
 */
type JSON_Device = {
	id: string;
	/**
	 * The addresses a notification gets send to
	 */
	subscriber: string[];
	/**
	 * Title of the notification
	 */
	notificationTitle?: string;
	/**
	 * Body of the notification
	 */
	notificationBody?: string;
	/**
	 * number of the box, the device is set up for
	 */
	boxNumber?: number;
	/**
	 * How soon the notification will be sent to the user
	 */
	checkInterval?: CheckInterval;
	/**
	 * The last time the box got emptied
	 */
	lastEmptied?: number;
	/**
	 * The fill history of the device since it has been emptied
	 */
	history: HistoryType[];
};

export declare interface IDevice extends JSON_Device {
	/**
	 * Wether the device is currently available
	 */
	get isOnline(): boolean;
	/**
	 * Wether the box is currently occupied
	 */
	get isOccupied(): boolean;
	/**
	 * Wether the device is completely configured by the user
	 */
	get isCompletelyConfigured(): boolean;
	/**
	 * The current weight of the contents in the box
	 */
	get currentWeight(): number;
	/**
	 * Wether the message has already been sent or is still pending
	 */
	messageAlreadySent: boolean;
	/**
	 * Title of the notification
	 */
	notificationTitle: string;
	/**
	 * Body of the notification
	 */
	notificationBody: string;

	// Subscribing to events
	on(
		event: 'onlineChanged' | 'occupiedChanged',
		callback: (status: boolean) => void
	): this;
	on(
		event: 'checkIntervalChanged',
		callback: (
			oldVal: CheckInterval | undefined,
			newVal: CheckInterval | undefined
		) => void
	): this;

	// Unsubscribe of the events
	off(
		event: 'onlineChanged' | 'occupiedChanged',
		callback: (status: boolean) => void
	): this;
	off(
		event: 'checkIntervalChanged',
		callback: (
			oldVal: CheckInterval | undefined,
			newVal: CheckInterval | undefined
		) => void
	): this;

	calcScaleOffset(): Promise<number>;
	calcScaleWeight(weight: number): Promise<number>;
	applyScaleCalibration(scaleOffset: number, scaleValue: number): void;
	cancelCalibration(): void;
}

export class Device extends EventEmitter implements IDevice {
	private _device: JSON_Device;
	private _isOnline: boolean = false;
	private _inCalibration: boolean = false;
	messageAlreadySent: boolean = false;

	constructor(device: JSON_Device) {
		super();
		this._device = device;
	}

	private calibrateOffsetMqttListener = (value: number) => {
		logger.error(
			'Calibrate should not been executed, currently not listening to it'
		);
	};
	private calibrateValueMqttListener = (value: number) => {
		logger.error(
			'Calibrate should not been executed, currently not listening to it'
		);
	};

	/**
	 * Handles the received mqtt message and updates its corresponding values depending
	 *
	 * @param topic The received mqtt topic
	 * @param payload The received mqtt payload
	 */
	_onMessageArrived(topic: string, payload: Buffer) {
		// TODO: Add logging
		switch (topic) {
			case '': // Register Device topic sent form server
			case 'command/CancelCalibration':
			case 'command/CalcOffset':
			case 'command/CalibrateScale':
			case 'command/ApplyCalibration':
				break;
			case 'online':
				// Update the online
				switch (payload.toString()) {
					case 'connected':
						this.isOnline = true;
						break;
					case 'disconnected':
						this.isOnline = false;
						break;
					default:
						// Payload is not right reset online and log
						this.isOnline = false;
						logger.warn(
							`${
								this._device.id
							} received unknown payload(${payload.toString()}) for online topic`
						);
						break;
				}
				break;
			case 'currentWeight':
				if (this._inCalibration) break;
				// Received new weight
				const newWeight = Number(payload.toString());

				// Catch duplicate weight because of retained flag
				if (newWeight === this.history.at(-1)?.weight) {
					logger.info(
						`${this._device.id} weight change has been ignored, because its value is the same (${newWeight}g)`
					);
					break;
				}

				// Get the current time for displaying it at the webinterface
				const timeStamp = Date.now().valueOf();

				if (newWeight <= Number(process.env.SCALE_THRESHOLD ?? '1')) {
					// The box has been emptied clear history and set occupied to false
					this.lastEmptied = timeStamp;
					this.history.splice(0, this.history.length);
					this.emit('occupiedChanged', false);
					logger.info(`${this._device.id} has been emptied`);

					this.messageAlreadySent = false;
				} else {
					// A new item has been inserted update the list
					this.history.push({ timeStamp, weight: newWeight });
					if (this.history.length === 1)
						this.emit('occupiedChanged', true);
					logger.info(
						`${this._device.id} weight changed to ${newWeight}`
					);
				}

				// Write weight update to file in case this service has to restart
				saveToFile(MQTTService.Instance.devices);
				break;
			case 'calibration/scaleOffset':
				this.calibrateOffsetMqttListener(Number(payload.toString()));
				break;
			case 'calibration/scaleValue':
				this.calibrateValueMqttListener(Number(payload.toString()));
				break;
			default:
				throw new Error(`Topic(${topic}) is unknown`);
		}
	}

	get id() {
		return this._device.id;
	}
	get subscriber() {
		return this._device.subscriber;
	}
	set subscriber(value) {
		this._device.subscriber = value;
	}
	get notificationTitle() {
		return this._device.notificationTitle ?? NOTIFICATION_DEFAULT_TITLE;
	}
	set notificationTitle(value) {
		if (value === '' || value === NOTIFICATION_DEFAULT_TITLE) {
			this._device.notificationTitle = undefined;
			return;
		}
		this._device.notificationTitle = value;
	}
	get notificationBody() {
		return this._device.notificationBody ?? NOTIFICATION_DEFAULT_BODY;
	}
	set notificationBody(value) {
		if (value === '' || value === NOTIFICATION_DEFAULT_BODY) {
			this._device.notificationBody = undefined;
			return;
		}
		this._device.notificationBody = value;
	}
	get boxNumber() {
		return this._device.boxNumber;
	}
	set boxNumber(value) {
		this._device.boxNumber = value;
		logger.info(
			`${this._device.id} box number changed to ${this._device.boxNumber}`
		);
	}
	get checkInterval() {
		return this._device.checkInterval;
	}
	set checkInterval(value) {
		if (value === this._device.checkInterval) return;
		// Emit event for check interval to update depending functionality
		this.emit('checkIntervalChanged', this._device.checkInterval, value);
		this._device.checkInterval = value;
		logger.info(
			`${this._device.id} check interval changed to ${this._device.checkInterval}`
		);
	}
	get lastEmptied() {
		return this._device.lastEmptied;
	}
	private set lastEmptied(value) {
		this._device.lastEmptied = value;
		logger.info(`${this._device.id} has been emptied`);
	}
	get history() {
		return this._device.history ?? [];
	}
	get isOnline() {
		return this._isOnline;
	}
	private set isOnline(value) {
		if (value === this._isOnline) return;
		this._isOnline = value;
		// Emit event for online state to update depending functionality
		this.emit('onlineChanged', this._isOnline);
		logger.info(
			`${this._device.id} state changed to ${
				this._isOnline ? 'online' : 'offline'
			}`
		);
	}
	get isOccupied() {
		return this.currentWeight > 0;
	}
	get isCompletelyConfigured() {
		// TODO: Fill in all important configurations
		return (
			!!this._device.boxNumber &&
			Number(this._device.subscriber?.length) > 0
		);
	}
	get currentWeight() {
		// Current weight is the weight of the last item in history
		return this.history.at(-1)?.weight ?? 0;
	}
	public toJSON() {
		// Overwrite the toJSON function to write only device information into the config file
		return {
			...this._device,
		};
	}
	public calcScaleOffset(): Promise<number> {
		// Start calibration
		this._inCalibration = true;

		return new Promise((resolve, reject) => {
			if (!this.isOnline) {
				reject('Device is offline');
				return;
			}

			const timeout = setTimeout(() => {
				reject(
					'Timeout for calcScaleOffset elapsed, response took to long'
				);
			}, 5_000);

			MQTTService.Instance.publish(
				`/${this._device.id}/command/CalcOffset`,
				Buffer.from('')
			);

			let temp = this.calibrateOffsetMqttListener;
			this.calibrateOffsetMqttListener = (value: number) => {
				clearTimeout(timeout);
				this.calibrateOffsetMqttListener = temp;

				resolve(value);
			};
		});
	}
	public calcScaleWeight(weight: number): Promise<number> {
		// Start calibration
		this._inCalibration = true;

		return new Promise((resolve, reject) => {
			if (!this.isOnline) {
				reject('Device is offline');
				return;
			}
			const timeout = setTimeout(() => {
				reject(
					'Timeout for calcScaleOffset elapsed, response took to long'
				);
			}, 5_000);

			MQTTService.Instance.publish(
				`/${this._device.id}/command/CalibrateScale`,
				Buffer.from(weight.toString())
			);

			let temp = this.calibrateValueMqttListener;
			this.calibrateValueMqttListener = (value: number) => {
				clearTimeout(timeout);
				this.calibrateValueMqttListener = temp;

				resolve(value);
			};
		});
	}

	public applyScaleCalibration(
		scaleOffset: number,
		scaleValue: number
	): void {
		MQTTService.Instance.publish(
			`/${this._device.id}/command/ApplyCalibration`,
			Buffer.from(
				JSON.stringify({
					offset: scaleOffset,
					value: scaleValue,
				})
			)
		);
		// Clear history
		this.history.splice(0, this.history.length);
		// Calibration ended
		this._inCalibration = false;
	}
	public cancelCalibration(): void {
		MQTTService.Instance.publish(
			`/${this._device.id}/command/CancelCalibration`,
			Buffer.from('')
		);
		// Clear history
		this.history.splice(0, this.history.length);
		// Calibration enden
		this._inCalibration = false;
	}
}

/**
 * Get already registered devices from the config file
 *
 * @returns An array of IDevices that has been read from the config file
 */
export function loadFromFile(): IDevice[] {
	try {
		// Read the config file
		const file = readFileSync(CONFIG_FILE);
		// If length is 0 no devices are registered, no need to do more
		if (file.buffer.byteLength <= 0) return [];

		let devices: IDevice[] = [];

		// Parse all read devices and add them to the returning array
		JSON.parse(file.toString()).forEach((device: JSON_Device) => {
			devices.push(new Device(device));
		});

		logger.info(`${devices.length} esp-devices read from file`);

		return devices;
	} catch (error) {
		let err = error as Error;
		// If there is no file no devices have been registered by this service yet
		// Therefor an empty array will be returned
		if (err.message.includes('no such file or directory, open')) {
			// File doesn't exist
			logger.info(
				'exp-clients.json file does not exist, use empty array'
			);
			return [];
		}

		// Another error has occurred log it and return an empty array
		logger.error(err.message);
		return [];
	}
}
/**
 * Saves the registered devices to a config file for reading them at a new start
 *
 * @param devices A list of registered devices
 */
export function saveToFile(devices: IDevice[]): void {
	try {
		// Create folder structure if it does not exist
		if (!existsSync(CONFIG_FILE)) {
			mkdirSync(CONFIG_FILE.substring(0, CONFIG_FILE.lastIndexOf('/')), {
				recursive: true,
			});
		}

		// Write devices to the file
		writeFileSync(CONFIG_FILE, JSON.stringify(devices));
		logger.info(`Updated esp-clients.json`);
	} catch (error) {
		// An error occurred, log it
		logger.error(error);
	}
}
