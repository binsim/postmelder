import { test, describe, expect } from '@jest/globals';
import {  StateService } from './status';

describe('Status', () => {
	jest.spyOn(console, 'error').mockImplementation(() => {});

	test('Status ok after start', () => {
		expect(StateService.Instance.isOk).toBe(true);
	});
	test('externalError', () => {
		StateService.Instance.mqttOnlineStateChanged(false);
		expect(StateService.Instance.externalError).toBe(true);
		expect(StateService.Instance.isOk).toBe(false);
		StateService.Instance.mqttOnlineStateChanged(true);
		expect(StateService.Instance.externalError).toBe(false);
		expect(StateService.Instance.isOk).toBe(true);
	});
});
