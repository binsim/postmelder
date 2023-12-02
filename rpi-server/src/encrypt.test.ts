import { describe, test, expect } from '@jest/globals';
import { encrypt, decrypt } from './encrypt';

describe('Encryption', () => {
	test('Encrypt-Decrypt', () => {
		let text = 'Hello Word!';

		let { iv, data, authTag } = encrypt(text);

		let decryptedText = decrypt({ iv, data, authTag });

		expect(encrypt(text, iv)).toStrictEqual({ iv, data, authTag });
		expect(decryptedText).toBe(text);
	});
});
