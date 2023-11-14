import { readFileSync, writeFileSync } from 'node:fs';

const CONFIG_FILE = 'data/esp-clients.json';

interface JSON_Device {
	id: string;
	subscriber: string[];
	notificationTitle: string;
	notificationBody: string;
}

export interface IDevice extends JSON_Device {
	get isOnline(): boolean;
	get isOccupied(): boolean;

	onOnlineChanged(callback: (status: boolean) => void): void;
	onOccupiedChanged(callback: (status: boolean) => void): void;
}

export class Device implements IDevice {
	private _device: JSON_Device;
	private _isOnline: boolean = false;
	private _isOccupied: boolean = false;

	private _onOnlineStatusChangedHandler:
		| ((status: boolean) => void)
		| undefined = undefined;
	private _onOccupiedChangedHandler: ((state: boolean) => void) | undefined =
		undefined;

	constructor(device: JSON_Device) {
		this._device = device;
	}

	_onMessageArrived(topic: string, payload: Buffer) {
		// TODO: Add logging

		switch (topic.split('/').at(-1)) {
			case 'online':
				const onlineStatus = payload.toString() === 'online';

				if (
					onlineStatus != this._isOnline &&
					this._onOnlineStatusChangedHandler
				) {
					this._onOnlineStatusChangedHandler(onlineStatus);
				}

				this._isOnline = onlineStatus;
				break;
			case 'status':
				const isOccupied = payload.toString() !== 'free';

				if (
					isOccupied !== this._isOccupied &&
					this._onOccupiedChangedHandler
				) {
					this._onOccupiedChangedHandler(isOccupied);
				}

				this._isOccupied = isOccupied;
				break;
			default:
				break;
		}
	}

	onOnlineChanged(callback: (status: boolean) => void) {
		this._onOnlineStatusChangedHandler = callback;
	}
	onOccupiedChanged(callback: (status: boolean) => void) {
		this._onOccupiedChangedHandler = callback;
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
		this._device.notificationBody;
	}
	get notificationTitle() {
		return this._device.notificationTitle;
	}
	set notificationTitle(value) {
		this._device.notificationTitle;
	}
	get isOnline() {
		return this._isOnline;
	}
	get isOccupied() {
		return this._isOccupied;
	}
}

export function loadFromFile(): IDevice[] {
	try {
		const file = readFileSync(CONFIG_FILE);
		if (file.buffer.byteLength <= 0) return [];

		return JSON.parse(file.toString()) as IDevice[];
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
