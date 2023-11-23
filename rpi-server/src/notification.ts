import { Transporter, createTransport } from 'nodemailer';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { scheduleJob } from 'node-schedule';
import { CheckInterval, IDevice } from './EspDevice';

export const DEFAULT_SMTP_PORT = 587;
const CONFIG_FILE = 'data/mail.json';

interface INotificationConfig {
	username: string;
	password: string;
	host: string;
	port?: number;
	secure: boolean;
}
export class NotificationService {
	private static _instance: NotificationService;
	private transporter: Transporter | undefined;
	private conf: INotificationConfig | undefined;
	private _hourlyDevices: IDevice[] = [];
	private _dailyDevices: IDevice[] = [];
	private _weeklyDevices: IDevice[] = [];

	private constructor() {
		// TODO: Read config from file and save it to the transporter
		try {
			const file = readFileSync(CONFIG_FILE);
			if (file.buffer.byteLength <= 0) throw new Error('File is empty');

			let data = JSON.parse(file.toString());
			if (!('transporter' in data))
				throw new Error("mail.json has no attribute 'transporter'");

			this.updateConfig(data['transporter'], false);
		} catch (error) {
			let err = error as Error;
			if (err.message.includes('no such file or directory, open')) {
				// Transporter stays undefined, can be configured later
				console.info(
					"Notification not configured, can't send messages to client"
				);
				return;
			}
			console.error(error);
			return;
		}

		scheduleJob('0 * * * *', () =>
			this.checkForSendingMessage(this._hourlyDevices)
		);
		scheduleJob('0 0 * * *', () =>
			this.checkForSendingMessage(this._dailyDevices)
		);
		scheduleJob('0 0 * * 1', () =>
			this.checkForSendingMessage(this._weeklyDevices)
		);
	}

	static get Instance() {
		if (this._instance === undefined)
			this._instance = new NotificationService();

		return this._instance;
	}
	get Config() {
		return this.conf;
	}

	isConnected() {
		return new Promise((resolve, _) => {
			if (this.transporter == undefined) {
				resolve(false);
				return;
			}

			this.transporter.verify((err) => {
				resolve(!err);
			});
		});
	}
	static testConfig(config: INotificationConfig) {
		return new Promise((resolve, reject) => {
			let options = this.getOptionsFromConfig(config);
			let transporter = createTransport(options);

			transporter.verify((err) => {
				resolve(!err);
			});
		});
	}

	addDevice(device: IDevice) {
		const changeHandler = (status: boolean) => {
			if (status && !device.messageAlreadySent) {
				this.sendMessage(device);
			}
		};
		const addDeviceToArr = (interval: CheckInterval | undefined) => {
			let arr = [];
			switch (interval) {
				case 'immediately':
					if (device.isOccupied && !device.messageAlreadySent)
						this.sendMessage(device);

					device.on('onlineChanged', changeHandler);
					break;

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
		};
		addDeviceToArr(device.checkInterval!);

		device.on('checkIntervalChanged', (oldVal, newVal) => {
			let arr: IDevice[] = [];
			switch (oldVal) {
				case 'immediately':
					device.off('onlineChanged', changeHandler);
					break;
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

			let i = arr.indexOf(device);
			if (i >= 0) arr.slice(i, 1);

			addDeviceToArr(newVal);
		});
	}

	async sendTestMessage(device: IDevice) {
		return await this.sendMessage(device, true);
	}
	private sendMessage(
		device: IDevice,
		isTestMessage = false
	): Promise<MailReturn> {
		return new Promise(async (resolve, reject) => {
			if (device.subscriber!.length <= 0) {
				reject(new Error('No target for message provided'));
				return;
			}
			if (
				this.conf?.username === undefined ||
				this.conf.username.length <= 0
			) {
				reject(new Error("Could't get sender for the message"));
				return;
			}
			if (!(await this.isConnected())) {
				reject(new Error('Transporter is not ok'));
				return;
			}

			//TODO: Handle rejected recipients
			try {
				const info: MailReturn = await this.transporter!.sendMail({
					from: this.conf.username,
					to: device.subscriber!.join(', '),
					subject: isTestMessage
						? `Test: ${device.notificationTitle}`
						: device.notificationTitle,
					text: device.notificationBody,
				});
				resolve(info);
			} catch (err) {
				//TODO: Make Error more readable
				reject(err);
				return;
			}
			if (!isTestMessage) device.messageAlreadySent = true;
		});
	}
	updateConfig(config: INotificationConfig, writeToFile = true) {
		this.transporter = createTransport(
			NotificationService.getOptionsFromConfig(config)
		);
		this.conf = config;
		if (writeToFile) {
			if (!existsSync(CONFIG_FILE)) {
				mkdirSync(
					CONFIG_FILE.substring(0, CONFIG_FILE.lastIndexOf('/')),
					{ recursive: true }
				);
			}
			writeFileSync(CONFIG_FILE, JSON.stringify({ transporter: config }));
		}
	}

	private checkForSendingMessage(devices: IDevice[]) {
		devices.forEach((device) => {
			if (device.isOccupied && !device.messageAlreadySent) {
				this.sendMessage(device);
			}
		});
	}

	private static getOptionsFromConfig(config: INotificationConfig) {
		let data: SMTPTransport.Options = {
			host: config.host,
			port: config.port ?? DEFAULT_SMTP_PORT,
			auth: {
				user: config.username,
				pass: config.password,
			},
		};

		if (config.secure) {
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
