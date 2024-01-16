import { init, open, write, OUTPUT, LOW, HIGH } from 'rpio';
import { IDevice } from './EspDevice';
import { logger } from './logging';
import { resolve } from 'dns';

export interface IStateService {
	get externalError(): boolean;
	get internalError(): boolean;
	get isOk(): boolean;

	addDeviceListener(device: IDevice): void;
	mqttOnlineStateChanged(isConnected: boolean): void;
}
export class StateService implements IStateService {
	private static _instance: StateService;
	private r_pin = Number(process.env.SERVER_R_PIN || '17');
	private g_pin = Number(process.env.SERVER_G_PIN || '27');
	private b_pin = Number(process.env.SERVER_B_PIN || '22');

	private deviceList: IDevice[] = [];
	private mqttError = false;
	private transporterError = false;
	private internetConnectionError = false;

	private constructor() {
		// TODO: Log warnings of this function
		init({ close_on_exit: true, mapping: 'gpio' });

		// Define Pins as output
		open(this.r_pin, OUTPUT, LOW);
		open(this.g_pin, OUTPUT, LOW);
		open(this.b_pin, OUTPUT, LOW);

		this.updateColor();

		setInterval(() => {
			resolve('google.com', (err, addr) => {
				if (err) {
					if (this.internetConnectionError) return;

					logger.warn('Internet connection lost');
					this.internetConnectionError = true;
					this.updateColor();
				} else {
					if (!this.internetConnectionError) return;

					logger.info('Internet connection established');
					this.internetConnectionError = false;
					this.updateColor();
				}
			});
		}, 60_000);
	}

	public static get Instance(): StateService {
		if (this._instance === undefined) this._instance = new StateService();
		return this._instance;
	}
	get externalError() {
		return (
			this.mqttError ||
			this.transporterError ||
			this.internetConnectionError
		);
	}
	get internalError() {
		return this.deviceList.length > 0;
	}
	get isOk() {
		return !this.externalError && !this.internalError;
	}

	/**
	 * Adds listener func for displaying state of device
	 *
	 * @param device Device to add
	 */
	addDeviceListener(device: IDevice) {
		// Show online state of configured devices

		device.on('onlineChanged', (value) => {
			if (!device.isCompletelyConfigured) {
				logger.info(
					`${device.id} online state ignored for status because it is not completely configured`
				);
				return;
			}

			if (!value) {
				this.addDeviceToList(device);
			} else {
				this.removeDeviceFromList(device);
			}
		});

		// Remove device if it got deleted
		device.on('delete', (device) => {
			if (!device.isOnline) {
				this.removeDeviceFromList(device);
			}
		});
		// Remove device if it has been reconfigured to get if it is added
		device.on('configurationUpdated', (device) => {
			if (device.isCompletelyConfigured && !device.isOnline) {
				this.addDeviceToList(device);
			}
		});

		// Add device to not connected list
		if (device.isCompletelyConfigured && !device.isOnline) {
			this.addDeviceToList(device);
		}
	}

	private removeDeviceFromList(device: IDevice) {
		// Remove device from connected list
		this.deviceList.splice(this.deviceList.indexOf(device) as number, 1);
		logger.info(`Removed ${device.id} from offline devices`);
		this.updateColor();
	}
	private addDeviceToList(device: IDevice) {
		// Add device to not connected list
		this.deviceList.push(device);
		logger.warn(`Added ${device.id} to offline devices`);
		this.updateColor();
	}

	/**
	 * Execute this if mqtt online state changed
	 * Will update colors depending on state
	 *
	 * @param isConnected Value of mqtt online state
	 */
	mqttOnlineStateChanged(isConnected: boolean) {
		this.mqttError = !isConnected;
		if (this.mqttError) {
			logger.warn('Lost MQTT connection');
		} else {
			logger.info('MQTT connection established');
		}
		this.updateColor();
	}
	/**
	 * Execute this if transporter state changed
	 * Will update colors depending on state
	 *
	 * @param isError Wether transporter is in error state
	 */
	transporterErrorChanged(isError: boolean) {
		this.transporterError = isError;
		if (this.transporterError) {
			logger.warn('SMTP Transporter not ok');
		} else {
			logger.info('SMTP Transporter ok');
		}
		this.updateColor();
	}

	/**
	 * Update GPIO output depending on states
	 */
	private updateColor() {
		write(this.r_pin, this.externalError ? HIGH : LOW);
		write(this.g_pin, this.isOk ? HIGH : LOW);
		write(this.b_pin, this.internalError ? HIGH : LOW);
		logger.info(
			`Updated color ${JSON.stringify({
				'MQTT Error': this.mqttError,
				'Transporter Error': this.transporterError,
				'Internet Connection Error': this.internetConnectionError,
				'Internal Error': `${this.internalError} [${this.deviceList
					.map((device) => device.id)
					.join(', ')}]`,
				'Alles Ok': this.isOk,
			})}`
		);
	}
}
