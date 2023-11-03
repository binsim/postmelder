import { init, open, write, OUTPUT, LOW, HIGH } from 'rpio';
import { IDevice } from './EspDevice';

export interface IStateService {
	get externalError(): boolean;
	get internalError(): boolean;
	get isOk(): boolean;

	addDeviceListener(device: IDevice): void;
	mqttOnlineStateChanged(isConnected: boolean): void;
}
export class StateService implements IStateService {
	private r_pin = 1;
	private g_pin = 1;
	private b_pin = 1;

	private deviceList: IDevice[] = [];
	private _externalError = false;

	constructor() {
		init({ close_on_exit: true, mapping: 'gpio' });

		// Define Pins as output
		open(this.r_pin, OUTPUT, LOW);
		open(this.g_pin, OUTPUT, LOW);
		open(this.b_pin, OUTPUT, LOW);

		this.updateColor();
	}

	get externalError() {
		return this._externalError;
	}
	get internalError() {
		return this.deviceList.length > 0;
	}
	get isOk() {
		return !this.externalError && !this.internalError;
	}

	addDeviceListener(device: IDevice) {
		device.onOnlineChanged((value) => {
			if (value) {
				this.deviceList.push(device);
			} else {
				this.deviceList.splice(
					this.deviceList.indexOf(device) as number,
					1
				);
			}
			this.updateColor();
		});
	}

	mqttOnlineStateChanged(isConnected: boolean) {
		this._externalError = !isConnected;
		this.updateColor();
	}

	private updateColor() {
		write(this.r_pin, this.externalError ? HIGH : LOW);
		write(this.g_pin, this.isOk ? HIGH : LOW);
		write(this.b_pin, this.internalError ? HIGH : LOW);
	}
}
