import { describe, test, expect } from '@jest/globals';
import { encrypt, decrypt } from './encrypt';

describe('Encryption', () => {
	// Test to check that a encrypted and then decrypted data stays the same
	test('Encrypt-Decrypt', () => {
		let text = 'Hello Word!';

		const hashData = encrypt(text);

		let decryptedText = decrypt(hashData);

		expect(encrypt(text, hashData.iv)).toStrictEqual(hashData);
		expect(decryptedText).toBe(text);
	});
});
