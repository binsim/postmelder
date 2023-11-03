import { test, describe, expect } from '@jest/globals';
import { IStateService, StateService } from './status';

describe('Status', () => {
	const states: IStateService = new StateService();

	test('Status ok nach start', () => {
		expect(states.isOk).toBe(true);
	});
	test('externalError', () => {
		states.mqttOnlineStateChanged(false);
		expect(states.externalError).toBe(true);
		expect(states.isOk).toBe(false);
		states.mqttOnlineStateChanged(true);
		expect(states.externalError).toBe(false);
		expect(states.isOk).toBe(true);
	});
});
