import { describe, test, expect } from '@jest/globals';
import { encrypt, decrypt } from './encrypt';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

describe('Encryption', () => {
	test('Encrypt-Decrypt', () => {
		let text = 'Hello Word!';

		let { iv, data, authTag } = encrypt(text);

		let decryptedText = decrypt({ iv, data, authTag });

		expect(encrypt(text, iv)).toStrictEqual({ iv, data, authTag });
		expect(decryptedText).toBe(text);
	});
	test('Encrypt-Decrypt with file', () => {
		let text = 'Hello Word!';

		writeFileSync('./encrypt.json', JSON.stringify(encrypt(text)), {
			flag: 'wx',
		});

		expect(
			decrypt(JSON.parse(readFileSync('./encrypt.json').toString()))
		).toBe(text);

		unlinkSync('./encrypt.json');
	});
});
