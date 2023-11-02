import { readFileSync, writeFileSync } from 'node:fs';

const CONFIG_FILE = 'data/esp-clients.json';

interface JSON_Device {
	get id(): string;
}

export interface IDevice extends JSON_Device {
	get isOnline(): boolean;
	get isOccupied(): boolean;

	onOnlineChanged(callback: (status: boolean) => void): void;
	onOccupiedChanged(callback: (status: boolean) => void): void;
}

export class Device implements IDevice {
	private readonly _id: string;
	private _isOnline: boolean = false;
	private _isOccupied: boolean = false;

	private _onOnlineStatusChangedHandler:
		| ((status: boolean) => void)
		| undefined = undefined;
	private _onOccupiedChangedHandler: ((state: boolean) => void) | undefined =
		undefined;

	constructor(id: string) {
		this._id = id;
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
		return this._id;
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
		if (file.buffer.byteLength <= 0) throw new Error('File is empty');

		return JSON.parse(file.toString()) as IDevice[];
	} catch (error) {
		console.log(error);
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
