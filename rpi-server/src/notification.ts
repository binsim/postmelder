import { Transporter, createTransport } from 'nodemailer';
import { readFileSync } from 'node:fs';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

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
		const file = readFileSync('data/mail.json');
		if (file.buffer.byteLength <= 0) throw new Error('File is empty');

		let data = JSON.parse(file.toString());
		if (!('transporter' in data))
			throw new Error("mail.json has no attribute 'transporter'");

		let transporterObj: SMTPTransport = data['transporter'];

		sender = transporterObj.auth.user;
		transporter = createTransport(transporterObj);
	} catch (error) {
		console.error(error);
		return;
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
