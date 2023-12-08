import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	createHash,
} from 'node:crypto';

export type HashData = { iv: string; data: string; authTag: string };

/**
 *
 * @returns Key for encrypting and decrypting
 */
function getKey() {
	return createHash('sha256')
		.update(process.env.KEY ?? '123456789')
		.digest('base64')
		.substring(0, 32);
}

/**
 * Encrypting an entered text
 *
 * @param text The text, that should be encrypted
 * @param iv The iv, that shall be used
 * @returns HashData for decrypting the data later on
 */
export function encrypt(
	text: string,
	iv: string | undefined = undefined
): HashData {
	// Create iv if not entered
	iv = iv ?? randomBytes(16).toString('hex');
	const cipher = createCipheriv(
		'aes-256-gcm',
		getKey(),
		Buffer.from(iv, 'hex')
	);

	return {
		iv,
		data: Buffer.concat([cipher.update(text), cipher.final()]).toString(
			'hex'
		),
		authTag: cipher.getAuthTag().toString('hex'),
	};
}
/**
 * Decrypt the entered HashData to text
 *
 * @param hash The HashData to decrypt the wanted data
 * @returns The decrypted data
 */
export function decrypt(hash: HashData): string {
	const { iv, data, authTag } = hash;
	const decipher = createDecipheriv(
		'aes-256-gcm',
		getKey(),
		Buffer.from(iv, 'hex')
	);
	decipher.setAuthTag(Buffer.from(authTag, 'hex'));

	return (
		decipher.update(Buffer.from(data, 'hex')).toString() +
		decipher.final('utf-8')
	);
}
