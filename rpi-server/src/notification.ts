import { Transporter, createTransport } from 'nodemailer';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { scheduleJob } from 'node-schedule';
import { CheckInterval, HistoryType, IDevice } from './EspDevice';
import { HashData, decrypt } from './encrypt';
import { logger } from './logging';
import { StateService } from './status';

export const DEFAULT_SMTP_PORT = 587;
const CONFIG_FILE = 'data/mail.json';

interface INotificationConfig {
	username: string;
	password: HashData;
	host: string;
	port?: number;
	ssl: boolean;
}
export class NotificationService {
	private static _instance: NotificationService;
	private transporter: Transporter | undefined;
	private conf: INotificationConfig | undefined;

	// Devices will either join one of these arrays and will send a notification
	// depending on the array or they will send a notification immediately
	private _hourlyDevices: IDevice[] = [];
	private _dailyDevices: IDevice[] = [];
	private _weeklyDevices: IDevice[] = [];

	private constructor() {
		// Read existing configuration from file
		try {
			const file = readFileSync(CONFIG_FILE);
			if (file.buffer.byteLength <= 0) throw new Error('File is empty');

			let data = JSON.parse(file.toString());
			if (!('transporter' in data))
				throw new Error("mail.json has no attribute 'transporter'");

			// Create transporter from file
			this.updateConfig(data['transporter'], false);
			logger.info('Read notification settings from file');
		} catch (error) {
			let err = error as Error;
			if (err.message.includes('no such file or directory, open'))
				// Transporter stays undefined, can be configured later
				logger.info(
					"Notification not configured, can't send messages to client"
				);
			else logger.error(error);
		}

		// Create jobs to be executed when their time elapsed
		// devices will join arrays according to their configuration
		scheduleJob('0 * * * *', () => {
			logger.info('HOURLY CHECK TRIGGERED');
			this.checkForSendingMessage(this._hourlyDevices);
		});
		scheduleJob('0 0 * * *', () => {
			logger.info('DAILY CHECK TRIGGERED');
			this.checkForSendingMessage(this._dailyDevices);
		});
		scheduleJob('0 0 * * 1', () => {
			logger.info('WEEKLY CHECK TRIGGERED');
			this.checkForSendingMessage(this._weeklyDevices);
		});
	}

	static get Instance() {
		if (this._instance === undefined)
			this._instance = new NotificationService();

		return this._instance;
	}
	get Config() {
		return this.conf;
	}

	/**
	 *
	 * @returns Current connection state
	 */
	isConnected() {
		return new Promise((resolve, _) => {
			if (this.transporter == undefined) {
				resolve(false);
				logger.warn('Transporter can not be connected if undefined');
				return;
			}

			this.transporter.verify((err) => {
				if (err) {
					logger.warn(`Transporter is not connected due to ${err}`);
				}
				resolve(!err);
			});
		});
	}
	/**
	 * Validate configuration independent of applied configuration
	 *
	 * @param config Configuration to test
	 * @returns returns true if configuration is valid
	 */
	static testConfig(config: INotificationConfig): Promise<boolean> {
		return new Promise((resolve, _) => {
			const options = this.getOptionsFromConfig(config);
			let transporter = createTransport(options);

			transporter.verify((err) => {
				resolve(!err);
			});
		});
	}

	/**
	 * Adds a device to the notification service and listens to its events
	 *
	 * @param device Device to add
	 */
	addDevice(device: IDevice) {
		device.on('onlineChanged', async (state: boolean) => {
			try {
				await this.sendMessage(
					device.subscriber,
					'Device online state',
					`${device.id} has changed its online state to ${
						device.isOnline ? 'online' : 'offline'
					}`
				);
				logger.info(`${device.id} online state sent via notification`);
			} catch (error) {
				logger.error(error);
			}
		});

		// The handler, if occupied changed
		const changeHandler = (status: boolean) => {
			if (status) {
				if (!device.messageAlreadySent) {
					logger.info(
						`${device.id} sent message due to being occupied`
					);
					this.sendDeviceMessage(device).catch((err) => {
						logger.error(err);
					});
				}
			}
		};
		const addDeviceToArr = (interval: CheckInterval | undefined) => {
			let arr = [];
			switch (interval) {
				case 'immediately':
					// Check if notification is waiting for being sent and send it
					if (device.isOccupied && !device.messageAlreadySent) {
						logger.info(
							`${device.id} sent message due to being occupied`
						);
						this.sendDeviceMessage(device).catch((err) => {
							logger.error(err);
						});
					}

					// Append handler
					device.on('occupiedChanged', changeHandler);
					break;

				// Select array for the device to be added in
				case 'daily':
					arr = this._dailyDevices;
					break;
				case 'hourly':
					arr = this._hourlyDevices;
					break;
				case 'weekly':
					arr = this._weeklyDevices;
					break;
			}

			arr.push(device);
			logger.info(`${device.id} has been added to notify on ${interval}`);
		};
		// execute function
		addDeviceToArr(device.checkInterval!);

		// execute function again, if value has changed after undoing previous
		device.on('checkIntervalChanged', (oldVal, newVal) => {
			let arr: IDevice[] = [];
			switch (oldVal) {
				case 'immediately':
					// remove handler
					device.off('occupiedChanged', changeHandler);
					break;

				// Select array to remove device from
				case 'daily':
					arr = this._dailyDevices;
					break;
				case 'hourly':
					arr = this._hourlyDevices;
					break;
				case 'weekly':
					arr = this._weeklyDevices;
					break;
			}
			logger.info(
				`${device.id} has been removed from notify on ${oldVal}`
			);

			// Remove device from array
			let i = arr.indexOf(device);
			if (i >= 0) arr.slice(i, 1);

			// setting new interval value
			addDeviceToArr(newVal);
		});
	}

	/**
	 * Executes a send message with appending 'Test: ' to the messages title
	 *
	 * @param device Device to send message from
	 * @returns Returns the result of sending the message
	 */
	async sendTestMessage(device: IDevice) {
		return await this.sendDeviceMessage(device, true);
	}
	private async sendDeviceMessage(
		device: IDevice,
		isTestMessage = false
	): Promise<MailReturn> {
		const info = await this.sendMessage(
			device.subscriber,
			NotificationService.insertVariables(
				isTestMessage
					? `Test: ${device.notificationTitle}`
					: device.notificationTitle,
				device
			),
			NotificationService.insertVariables(device.notificationBody, device)
		);

		// Log all rejected targets
		if (info.rejected.length > 0) {
			logger.warn(
				`${
					device.id
				} send a message with rejected recipients [${info.rejected.join(
					', '
				)}]`
			);
		}
		// Log all accepted targets
		if (info.accepted.length > 0) {
			logger.info(
				`${
					device.id
				} send a message successfully to [${info.accepted.join(', ')}]`
			);
		}

		// set sent to be true, to not send a message again
		if (!isTestMessage) device.messageAlreadySent = true;

		return info;
	}
	private sendMessage(
		subscriber: string[],
		subject: string | undefined,
		text: string | undefined
	): Promise<MailReturn> {
		return new Promise(async (resolve, reject) => {
			// To send a message, targets are necessary
			if (subscriber!.length <= 0) {
				reject(new Error('No target for message provided'));
				return;
			}
			// A message also needs a sender
			if (
				this.conf?.username === undefined ||
				this.conf.username.length <= 0
			) {
				reject(new Error("Could't get sender for the message"));
				return;
			}
			// The transporter needs to be online in order to send a message
			if (!(await this.isConnected())) {
				// Show error for user
				StateService.Instance.transporterErrorChanged(true);

				reject(new Error('Transporter is not ok'));
				return;
			}

			try {
				// Send the message
				const info: MailReturn = await this.transporter!.sendMail({
					from: this.conf.username,
					to: subscriber!.join(', '),
					subject,
					text,
				});

				// Clear transporter error if it exists
				StateService.Instance.transporterErrorChanged(false);

				// Return for user information
				resolve(info);
			} catch (err) {
				//TODO: Make Error more readable
				reject(err);
				return;
			}
		});
	}

	/**
	 * Updates the configuration and creates a transporter from it
	 *
	 * @param config New configuration
	 * @param writeToFile Wether the configuration should be written to the config file
	 */
	updateConfig(config: INotificationConfig, writeToFile = true) {
		// Create transporter from new configuration
		this.transporter = createTransport(
			NotificationService.getOptionsFromConfig(config)
		);
		this.conf = config;
		if (writeToFile) {
			// Create folder structure if it does not exist
			if (!existsSync(CONFIG_FILE)) {
				mkdirSync(
					CONFIG_FILE.substring(0, CONFIG_FILE.lastIndexOf('/')),
					{ recursive: true }
				);
			}

			writeFileSync(CONFIG_FILE, JSON.stringify({ transporter: config }));
			logger.info('Successfully update NotificationService config');
		}
	}

	/**
	 *
	 * @param msg The message before replacing
	 * @param device The device to get the information from
	 * @returns The string with inserted values
	 */
	private static insertVariables(
		msg: string | undefined,
		device: IDevice
	): string | undefined {
		if (msg === undefined) return undefined;
		return msg
			.replace(
				new RegExp('{BOXNR}', 'g'),
				device.boxNumber?.toString() ?? '{BOXNR:undefined}'
			)
			.replace(
				new RegExp('{WEIGHT}', 'g'),
				device.currentWeight
					? device.currentWeight.toLocaleString() + 'g'
					: '{WEIGHT:undefined}'
			)
			.replace(
				new RegExp('{LASTEMPTIED}', 'g'),
				device.lastEmptied
					? new Date(device.lastEmptied).toLocaleString()
					: '{LASTEMPTIED:undefined}'
			)
			.replace(
				new RegExp('{HISTORY}', 'g'),
				device.history
					? `\n${device.history
							.map(
								(el) =>
									`${new Date(
										el.timeStamp
									).toLocaleString()}: ${el.weight.toLocaleString()}g`
							)
							.join('\n')}\n`
					: '{HISTORY:undefined}'
			);
	}

	/**
	 * Checks array for a device to send a message
	 *
	 * @param devices The array
	 */
	private checkForSendingMessage(devices: IDevice[]) {
		devices.forEach((device) => {
			logger.info(
				`Checking device: ${device.id}: {occupied: ${device.isOccupied}, messageAlreadySent: ${device.messageAlreadySent}}`
			);
			if (device.isOccupied && !device.messageAlreadySent) {
				logger.info(
					`${device.id} sent message due to checkForSendingMessage`
				);
				this.sendDeviceMessage(device).catch((err) => {
					logger.error(err);
				});
			}
		});
	}

	/**
	 * Converts config to SMTPTransport.Options
	 */
	private static getOptionsFromConfig(config: INotificationConfig) {
		let data: SMTPTransport.Options = {
			host: config.host,
			port: config.port ?? DEFAULT_SMTP_PORT,
			auth: {
				user: config.username,
				pass: decrypt(config.password),
			},
		};

		if (config.ssl) {
			data.tls = { ciphers: 'SSLv3' };
			data.secure = false;
		}

		return data;
	}
}

interface MailReturn {
	accepted: string[];
	rejected: string[];
	ehlo: string[];
	rejectedErrors: any[] | undefined;
	envelopeTime: number;
	messageTime: number;
	messageSize: number;
	response: string;
	envelope: {
		from: string;
		to: string[];
	};
	messageId: string;
}
