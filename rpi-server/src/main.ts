import express, { Express, Request, Response } from 'express';
import { config } from 'dotenv';
import { MQTTService } from './mqttService';
import { StateService } from './status';
import { DEFAULT_SMTP_PORT, NotificationService } from './notification';
import {
	CheckIntervals,
	NOTIFICATION_DEFAULT_BODY,
	NOTIFICATION_DEFAULT_TITLE,
} from './EspDevice';
import { encrypt } from './encrypt';
import { logger } from './logging';

logger.info(
	'#################################################  Starting   ###########################################################'
);

//#region Setup
// Important for using .env variables
config();
const PORT = 8080;
const app: Express = express();

app.use(express.static('public'));
app.use(express.json()); // to support JSON-encoded bodies
app.use(express.urlencoded({ extended: true })); // to support URL-encoded bodies;

// set the view engine to ejs
app.set('view engine', 'ejs');

// Run ctor
NotificationService.Instance;
StateService.Instance;

// Attach MQTT online to StateService to be shown for user
MQTTService.Instance.on('connectionChanged', (value) =>
	StateService.Instance.mqttOnlineStateChanged(value)
);
// Add new device to NotificationService and StateService
MQTTService.Instance.on('deviceAdded', (device) => {
	NotificationService.Instance.addDevice(device);
	StateService.Instance.addDeviceListener(device);
});

// Connect to MQTT Broker
MQTTService.Instance.connect();
//#endregion Setup

//#region API

app.get('/', (_: Request, res: Response) => {
	res.render('pages/index', {
		devices: {
			configured: MQTTService.Instance.devices.filter(
				(device) => device.isCompletelyConfigured
			),
			toConfigure: MQTTService.Instance.devices.filter(
				(device) => !device.isCompletelyConfigured
			),
		},
		constants: {
			checkIntervals: CheckIntervals,
			DEFAULT_SMTP_PORT,
			NOTIFICATION_DEFAULT_BODY,
			NOTIFICATION_DEFAULT_TITLE,
		},
		mailConf: {
			...NotificationService.Instance.Config,
		},
	});
});

// Send a test message to the specified subscribers and respond to the user
app.get('/testMessage', async (req, res) => {
	// Check if id is correctly given
	if (typeof req.query.id !== 'string') {
		res.status(400).send('ID is not a string');
		return;
	}

	// Try getting device with given id
	const device = MQTTService.Instance.getDeviceByID(req.query.id);
	if (device === undefined) {
		res.status(400).send('Entered id not found');
		return;
	}

	try {
		// Sending the message to the subscribers
		const response = await NotificationService.Instance.sendTestMessage(
			device
		);

		// Message has been sent successfully
		// sending full response to the user for log
		// TODO: optimize response to not send unwanted information
		res.status(200).json(response);
	} catch (error) {
		// Message can not be sent
		logger.error(error);
		res.status(400).send(
			'Error while sending test message, please check log file'
		);
		return;
	}
});

// Get information about the given box
app.get('/boxDetails', (req, res) => {
	// Check if a box id has been entered
	if (req.query.id === undefined) {
		// No device id has been entered
		res.sendStatus(400);
		return;
	}

	// Try getting device with given id
	const device = MQTTService.Instance.getDeviceByID(req.query.id as string);
	if (device === undefined) {
		// Device has not been found
		res.sendStatus(404);
		return;
	}

	// Sending the required information
	res.status(200).json({
		lastEmptied: device.lastEmptied,
		history: device.history,
	});
});

// Notification configuration has been modified and shall be updated
app.post('/notServiceConf', async (req, res) => {
	// Cancel button has been pressed
	// Do nothing and return to homepage
	if (req.body.cancel !== undefined) {
		res.redirect('/');
		return;
	}

	// Add password to body if it can't be changed if username hasn't been changed
	if (req.body.username === NotificationService.Instance.Config?.username) {
		if (!req.body.password) {
			// Password has not been changed but needed for validating transporter
			req.body.password = NotificationService.Instance.Config?.password;
		} else {
			// Encrypting the newly added password for saving to file
			req.body.password = encrypt(req.body.password);
		}
	} else {
		if (!req.body.password) {
			// A password is necessary for a user
			// do not update
			res.status(400).send(
				'No password given, please add a password for current user'
			);
			return;
		}
		// Encrypting the newly added password for saving to file
		req.body.password = encrypt(req.body.password);
	}
	// set port to default port if no port has been entered
	req.body.port = req.body.port ? Number(req.body.port) : DEFAULT_SMTP_PORT;
	// convert ssl to bool
	req.body.ssl = req.body.ssl === 'on';

	// check if newly entered config is valid for the transporter
	// TODO: get reason why transporter is invalid
	let isValid = await NotificationService.testConfig(req.body);
	if (!isValid) {
		// transporter is invalid do not change and inform the user about it
		// TODO: Send more information
		res.status(422).send('Connection to given SMTP Server not possible');
		logger.warn(
			'Newly added notification configuration not valid, will not update'
		);
		return;
	}

	try {
		// Update the configuration
		NotificationService.Instance.updateConfig(req.body);
		// Return to homepage
		res.redirect('/');
	} catch (error) {
		// Something went wrong by updating the config
		// inform the user
		logger.error(error);
		res.status(400).send(
			'Error while updating config, please check log file'
		);
		return;
	}
});

// Configure a device that is used for a box number
app.post('/config-device', (req, res) => {
	// Cancel button has been pressed return to homepage
	if (req.body.cancel !== undefined) {
		res.status(200);
		res.redirect('/');
		return;
	}

	// check if id has been given
	if (req.body.id === undefined) {
		// No device id has been entered
		res.sendStatus(400);
		return;
	}

	// Try getting device by given id
	const device = MQTTService.Instance.getDeviceByID(req.body.id);
	if (device === undefined) {
		// Unexpected can't add new device from web
		res.sendStatus(404);
		logger.warn(
			`Can't configure device(${req.body.id}) because it has not been discoverd yet`
		);
		return;
	}

	// Delete button has been pressed clear box number configuration
	if (req.body.delete !== undefined) {
		device.boxNumber = undefined;
		device.notificationBody = '';
		device.notificationTitle = '';
		device.subscriber = [];
		device.checkInterval = undefined;
		device.lastEmptied = undefined;
		device.history.splice(0, device.history.length);

		logger.info(
			`device(${req.body.id}) as been deleted using the web interface`
		);
	} else {
		// Convert boxNumber to Number
		req.body.boxNumber = Number(req.body.boxNumber);
		if (isNaN(req.body.boxNumber)) {
			// Let user know that it can not be converted to a number
			res.status(400).json({
				...req.body,
				error: 'boxNumber not a number',
			});
			return;
		}

		// Updating the device info
		device.boxNumber = req.body.boxNumber;
		device.notificationBody = req.body.body;
		device.notificationTitle = req.body.subject;
		device.subscriber = req.body.to.split('; ');
		device.checkInterval = req.body.checkInterval;
	}

	// Apply changes to the device
	MQTTService.Instance.updateDevice(device);

	// Everything went good return to homepage
	res.status(200);
	res.redirect('/');
});
app.post('/calibrate/:clientID/:stage', async (req, res) => {
	// Try getting device by given id
	const device = MQTTService.Instance.getDeviceByID(req.params.clientID);
	if (device === undefined) {
		res.sendStatus(404);
		return;
	}

	try {
		switch (req.params.stage) {
			case '0': {
				const scaleOffset = await device.calcScaleOffset();
				res.status(200).json({
					scaleOffset,
				});
				return;
			}
			case '1': {
				const weight = Number(req.body.weight);
				if (isNaN(weight) || weight <= 0) {
					res.status(400).send('weight is not correctly defined');
					return;
				}
				const scaleValue = await device.calcScaleWeight(weight);
				res.status(200).json({
					scaleValue,
				});
				return;
			}
			case '2': {
				// Get configuration data from form
				const scaleOffset = Number(req.body['scale-offset']);
				const scaleValue = Number(req.body['scale-value']);

				// Validate data for being a valid number
				if (isNaN(scaleOffset) || isNaN(scaleValue)) {
					// Send error to user
					res.status(400).send('Offset or Value is invalid');
					return;
				}
				// Send data to device to apply it
				device.applyScaleCalibration(scaleOffset, scaleValue);

				// Return to homepage
				res.redirect('/');

				// TODO: Check if applying was successfully and notify user
				return;
			}
			case 'cancel':
				// Send message to client to cancel calibration
				device.cancelCalibration();
				break;
			default:
				// Notify user that entered stage is not valid
				res.status(404).send('Invalid stage');
				return;
		}
	} catch (error) {
		logger.error(error);
		res.status(500).send(error);
	}
});
//#endregion API

// Start web service
app.listen(PORT, () => {
	logger.info(`Server is running at http://localhost:${PORT}`);
});
