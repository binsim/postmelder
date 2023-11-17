import EventEmitter from 'node:events';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const CONFIG_FILE = 'data/esp-clients.json';
export const CheckInterals = [
	'immediately',
	'hourly',
	'daily',
	'weekly',
] as const;
export type CheckInterval = (typeof CheckInterals)[number];

interface JSON_Device {
	id: string;
	subscriber: string[];
	notificationTitle?: string;
	notificationBody?: string;
	boxNumber?: number;
	checkInterval?: CheckInterval;
	lastEmptied?: number;
	history: { timeStamp: number; weight: number }[];
}

export declare interface IDevice extends JSON_Device {
	get isOnline(): boolean;
	get isOccupied(): boolean;
	get isCompletelyConfiguerd(): boolean;
	get currentWeight(): number;
	messageAlreadySent: boolean;

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
}

export class Device extends EventEmitter implements IDevice {
	private _device: JSON_Device;
	private _isOnline: boolean = false;
	messageAlreadySent: boolean = false;

	constructor(device: JSON_Device) {
		super();
		this._device = device;
	}

	_onMessageArrived(topic: string, payload: Buffer) {
		// TODO: Add logging

		switch (topic.split('/').at(-1)) {
			case 'online':
				this.isOnline = payload.toString() === 'online';
				break;
			// TODO: add getting new weight
			case 'currentWeight':
				const newWeight = Number(payload.toString());
				const timeStamp = Date.now().valueOf();
				if (newWeight <= 0) {
					this.lastEmptied = timeStamp;
					this.history.splice(0, this.history.length);
					this.emit('occupiedChanged', false);
				} else {
					this.history.push({ timeStamp, weight: newWeight });
					if (this.history.length === 1)
						this.emit('occupiedChanged', true);
				}
				break;
			default:
				break;
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
	get notificationBody() {
		return this._device.notificationBody;
	}
	set notificationBody(value) {
		this._device.notificationBody = value;
	}
	get notificationTitle() {
		return this._device.notificationTitle;
	}
	set notificationTitle(value) {
		this._device.notificationTitle = value;
	}
	get boxNumber() {
		return this._device.boxNumber;
	}
	set boxNumber(value) {
		this._device.boxNumber = value;
	}
	get isOnline() {
		return this._isOnline;
	}
	get checkInterval() {
		return this._device.checkInterval;
	}
	set checkInterval(value) {
		if (value === this._device.checkInterval) return;
		this.emit('checkIntervalChanged', this._device.checkInterval, value);
		this._device.checkInterval = value;
	}
	private set isOnline(value) {
		if (value === this._isOnline) return;
		this._isOnline = value;
		this.emit('onlineChanged', this._isOnline);
	}
	get isOccupied() {
		return this.currentWeight > 0;
	}
	get isCompletelyConfiguerd() {
		return (
			!!this._device.boxNumber &&
			Number(this._device.subscriber?.length) > 0
		);
	}
	get currentWeight() {
		let weight = 0;
		this.history.forEach((i) => (weight += i.weight));
		return weight;
	}
	get lastEmptied() {
		return this._device.lastEmptied;
	}
	private set lastEmptied(value) {
		this._device.lastEmptied = value;
		// TODO: Emit event
	}
	get history() {
		return this._device.history;
	}
	public toJSON() {
		return {
			...this._device,
		};
	}
}

export function loadFromFile(): IDevice[] {
	try {
		const file = readFileSync(CONFIG_FILE);
		if (file.buffer.byteLength <= 0) return [];

		let devices: IDevice[] = [];

		JSON.parse(file.toString()).forEach((device: JSON_Device) => {
			devices.push(new Device(device));
		});

		return devices;
	} catch (error) {
		let err = error as Error;
		if (err.message.includes('no such file or directory, open')) {
			// File doesn't exist
			return [];
		}
		console.error(err.message);
		return [];
	}
}
export function saveToFile(devices: IDevice[]): void {
	try {
		if (!existsSync(CONFIG_FILE)) {
			mkdirSync(CONFIG_FILE.substring(0, CONFIG_FILE.lastIndexOf('/')), {
				recursive: true,
			});
		}
		writeFileSync(CONFIG_FILE, JSON.stringify(devices as JSON_Device[]));
	} catch (error) {
		console.error(error);
	}
}
