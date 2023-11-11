import { Transporter, createTransport } from 'nodemailer';
import { readFileSync, writeFileSync } from 'node:fs';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

const CONFIG_FILE = 'data/mail.json';

let transporter: Transporter | undefined;
let sender: string | undefined;

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

function readFromConfigFile() {
	try {
		const file = readFileSync(CONFIG_FILE);
		if (file.buffer.byteLength <= 0) throw new Error('File is empty');

		let data = JSON.parse(file.toString());
		if (!('transporter' in data))
			throw new Error("mail.json has no attribute 'transporter'");

		if (!_updateTransporter(data['transporter'])) {
			console.info(
				"Couldn't read mail.json file. Mail transporter is undefined"
			);
		}
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
/**
 * Updating the transporter and updating the config file
 * @param options Options for the transpoter
 * @returns true: if transporter has been created successfully
 */
export function updateTransporter(options: SMTPTransport.Options): boolean {
	const result = _updateTransporter(options);

	if (result) writeFileSync(CONFIG_FILE, JSON.stringify(options));

	return result;
}
/**
 * Updating the transporter without writing to the file
 * @param options Options for the transpoter
 * @returns true: if transporter has been created successfully
 */
function _updateTransporter(options: SMTPTransport.Options): boolean {
	// TODO: Make some fields required for setting a transporter

	try {
		sender = options.auth?.user;
		transporter = createTransport(options);
		return true;
	} catch (error) {
		console.error(error);
		return false;
	}
}
readFromConfigFile();

export async function isTransportOk(): Promise<boolean> {
	return new Promise((resolve, _) => {
		// Can't be valid if transporter is undefined
		if (transporter === undefined) {
			resolve(false);
			return;
		}

		transporter.verify((err: Error | null) => {
			resolve(!err);
		});
	});
}

export async function sendMessage(
	to: string[],
	subject: string,
	text: string
): Promise<MailReturn> {
	return new Promise(async (resolve, reject) => {
		if (to.length <= 0) {
			reject(new Error('No target for message proviede'));
			return;
		}
		if (sender === undefined || sender.length <= 0) {
			reject(new Error("Could't get sender for the message"));
			return;
		}
		if (!(await isTransportOk())) {
			reject(new Error('Transporter is not ok'));
			return;
		}

		//TODO: Handle rejected recipients
		try {
			const info: MailReturn = await transporter!.sendMail({
				from: sender,
				to: to.join(', '),
				subject,
				text,
			});
			resolve(info);
		} catch (err) {
			//TODO: Make Error more readable
			reject(err);
			return;
		}
	});
}
