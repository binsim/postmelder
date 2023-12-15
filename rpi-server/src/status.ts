import { init, open, write, OUTPUT, LOW, HIGH } from 'rpio';
import { IDevice } from './EspDevice';
import { logger } from './logging';

export interface IStateService {
	get externalError(): boolean;
	get internalError(): boolean;
	get isOk(): boolean;

	addDeviceListener(device: IDevice): void;
	mqttOnlineStateChanged(isConnected: boolean): void;
}
export class StateService implements IStateService {
	private static _instance: StateService;
	private r_pin = Number(process.env.SERVER_R_PIN);
	private g_pin = Number(process.env.SERVER_G_PIN);
	private b_pin = Number(process.env.SERVER_B_PIN);

	private deviceList: IDevice[] = [];
	private _externalError = false;

	private constructor() {
		if (!this.pinsDefined) {
			logger.error(
				`Can not use RGB-LED because a LED is undefined ${JSON.stringify(
					{ r: this.r_pin, g: this.g_pin, b: this.b_pin }
				)}`
			);
			return;
		}

		// TODO: Log warnings of this function
		init({ close_on_exit: true, mapping: 'gpio' });

		// Define Pins as output
		open(this.r_pin, OUTPUT, LOW);
		open(this.g_pin, OUTPUT, LOW);
		open(this.b_pin, OUTPUT, LOW);

		this.updateColor();
	}

	public static get Instance(): StateService {
		if (this._instance === undefined) this._instance = new StateService();
		return this._instance;
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
	private get pinsDefined() {
		return !(isNaN(this.r_pin) || isNaN(this.g_pin) || isNaN(this.g_pin));
	}

	/**
	 * Adds listener func for displaying state of device
	 *
	 * @param device Device to add
	 */
	addDeviceListener(device: IDevice) {
		device.on('onlineChanged', (value) => {
			if (!value) {
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

	/**
	 * Execute this if mqtt online state changed
	 * Will update colors depending on state
	 *
	 * @param isConnected Value of mqtt online state
	 */
	mqttOnlineStateChanged(isConnected: boolean) {
		this._externalError = !isConnected;
		this.updateColor();
	}

	/**
	 * Update GPIO output depending on states
	 */
	private updateColor() {
		if (!this.pinsDefined) return;

		write(this.r_pin, this.externalError ? HIGH : LOW);
		write(this.g_pin, this.isOk ? HIGH : LOW);
		write(this.b_pin, this.internalError ? HIGH : LOW);
		logger.info('Updated state colors');
	}
}
