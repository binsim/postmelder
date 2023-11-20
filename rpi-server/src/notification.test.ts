import { test, describe, expect } from '@jest/globals';
import { NotificationService } from './notification';

describe('NotificationService', () => {
	test('Replace box number', () => {
		let subject = 'Box {BOXNR} got occupied';
		let text = 'Box {BOXNR} got occupied \n\nPlease check {BOXNR}';

		expect(
			(NotificationService as any).insertVariables(subject, {
				boxNumber: 1,
			})
		).toBe('Box 1 got occupied');
		expect(
			(NotificationService as any).insertVariables(text, { boxNumber: 1 })
		).toBe('Box 1 got occupied \n\nPlease check 1');
	});
});
