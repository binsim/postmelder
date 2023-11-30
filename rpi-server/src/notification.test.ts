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
	test('Replace weight', () => {
		let text = 'The weight of the box has changed to {WEIGHT}';

		expect(
			(NotificationService as any).insertVariables(text, {
				currentWeight: 10.1,
			})
		).toBe(
			`The weight of the box has changed to ${(10.1).toLocaleString()}g`
		);
	});
	test('Replace lastEmptied', () => {
		let text = 'Box hast been emptied last at {LASTEMPTIED}';
		const time = Date.now().valueOf();

		expect(
			(NotificationService as any).insertVariables(text, {
				lastEmptied: time,
			})
		).toBe(
			'Box hast been emptied last at ' + new Date(time).toLocaleString()
		);
	});
	test('Replace history', () => {
		let text = 'Box fill history:\n{HISTORY}';
		const time = Date.now().valueOf();

		expect(
			(NotificationService as any).insertVariables(text, {
				history: [
					{ timeStamp: time, weight: 10.1 },
					{ timeStamp: time, weight: 20.5 },
				],
			})
		).toBe(
			`Box fill history:\n\n${new Date(
				time
			).toLocaleString()}: ${(10.1).toLocaleString()}g\n${new Date(
				time
			).toLocaleString()}: ${(20.5).toLocaleString()}g\n`
		);
	});
});
