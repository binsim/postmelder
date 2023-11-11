import { Transporter, createTransport } from 'nodemailer';
import { readFileSync, writeFileSync } from 'node:fs';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

export const DEFAULT_SMTP_PORT = 587;
const CONFIG_FILE = 'data/mail.json';

interface INotificationConfig {
	username: string;
	password: string;
	host: string;
	port?: number;
	secure: boolean;
	tls?: { ciphers: string };
}
export class NotificationService {
	private static _instance: NotificationService;
	private transporter: Transporter | undefined;
	private conf: INotificationConfig | undefined;

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

	sendMessage(
		to: string[],
		subject: string,
		message: string
	): Promise<MailReturn> {
		return new Promise(async (resolve, reject) => {
			if (to.length <= 0) {
				reject(new Error('No target for message proviede'));
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
					to: to.join(', '),
					subject,
					text: message,
				});
				resolve(info);
			} catch (err) {
				//TODO: Make Error more readable
				reject(err);
				return;
			}
		});
	}
	updateConfig(config: INotificationConfig, writeToFile = true) {
		this.transporter = createTransport(this.getOptionsFromConfig(config));
		this.conf = config;
		if (writeToFile)
			writeFileSync(CONFIG_FILE, JSON.stringify({ transporter: config }));
	}

	private getOptionsFromConfig(
		config: INotificationConfig
	): SMTPTransport.Options {
		return {
			host: config.host,
			port: config.port ?? DEFAULT_SMTP_PORT,
			secure: config.secure,
			auth: {
				user: config.username,
				pass: config.password,
			},
			tls: {
				ciphers: 'SSLv3',
			},
		};
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
