import EventEmitter from 'node:events';
import { readFileSync, writeFileSync } from 'node:fs';

const CONFIG_FILE = 'data/esp-clients.json';

interface JSON_Device {
	id: string;
	subscriber?: string[];
	notificationTitle?: string;
	notificationBody?: string;
	boxNumber?: number;
}

export declare interface IDevice extends JSON_Device {
	get isOnline(): boolean;
	get isOccupied(): boolean;
	get isCompletelyConfiguerd(): boolean;

	on(
		event: 'onlineChanged' | 'occupiedChanged',
		callback: (status: boolean) => void
	): this;
}

export class Device extends EventEmitter implements IDevice {
	private _device: JSON_Device;
	private _isOnline: boolean = false;
	private _isOccupied: boolean = false;

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
			case 'status':
				this.isOccupied = payload.toString() !== 'free';
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
	private set isOnline(value) {
		if (value === this._isOnline) return;
		this._isOnline = value;
		this.emit('onlineChanged', this._isOnline);
	}
	get isOccupied() {
		return this._isOccupied;
	}
	private set isOccupied(value) {
		if (value === this._isOccupied) return;
		this._isOccupied = value;
		this.emit('occupiedChanged', this._isOccupied);
	}
	get isCompletelyConfiguerd() {
		return (
			!!this._device.boxNumber &&
			Number(this._device.subscriber?.length) > 0
		);
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
		writeFileSync(CONFIG_FILE, JSON.stringify(devices as JSON_Device[]));
	} catch (error) {
		console.error(error);
	}
}
