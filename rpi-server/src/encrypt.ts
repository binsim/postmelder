import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	createHash,
} from 'node:crypto';

const key = createHash('sha256')
	.update(process.env.KEY ?? '123456789')
	.digest('base64')
	.substring(0, 32);

export function encrypt(text: string, iv: string | undefined = undefined) {
	iv = iv ?? randomBytes(16).toString('hex');
	const cipher = createCipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));

	let data = Buffer.concat([cipher.update(text), cipher.final()]).toString(
		'hex'
	);

	return {
		iv,
		data,
		authTag: cipher.getAuthTag().toString('hex'),
	};
}
export function decrypt(hash: { iv: string; data: string; authTag: string }) {
	const decipher = createDecipheriv(
		'aes-256-gcm',
		key,
		Buffer.from(hash.iv, 'hex')
	);
	decipher.setAuthTag(Buffer.from(hash.authTag, 'hex'));

	return (
		decipher.update(Buffer.from(hash.data, 'hex')).toString('utf-8') +
		decipher.final('utf-8')
	);
}
