import express, { Express, Request, Response } from 'express';
import { config } from 'dotenv';
import { MQTTService } from './mqttService';
import { StateService, IStateService } from './status';
import { DEFAULT_SMTP_PORT, NotificationService } from './notification';
import { CheckIntervals, IDevice } from './EspDevice';
import { logger } from './logging';

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
const stateService: IStateService = new StateService();

MQTTService.Instance.on('connectionChanged', (value) =>
	stateService.mqttOnlineStateChanged(value)
);
MQTTService.Instance.on('deviceAdded', (device) => {
	NotificationService.Instance.addDevice(device);
	stateService.addDeviceListener(device);
});
MQTTService.Instance.connect();
//#endregion Setup

//#region API
app.get('/', (req: Request, res: Response) => {
	let devices;
	{
		const configured: IDevice[] = [];
		const toConfigure: IDevice[] = [];

		MQTTService.Instance.devices.forEach((device) => {
			if (device.isCompletelyConfigured) {
				configured.push(device);
			} else {
				toConfigure.push(device);
			}
		});

		devices = {
			configured,
			toConfigure,
		};
	}

	res.render('pages/index', {
		devices,
		constants: {
			checkIntervals: CheckIntervals,
			DEFAULT_SMTP_PORT,
		},
		mailConf: {
			...NotificationService.Instance.Config,
		},
	});
});
app.get('/testMessage', async (req, res) => {
	if (typeof req.query.id !== 'string') {
		res.status(400).send('ID is not a string');
		return;
	}
	const device = MQTTService.Instance.getDeviceByID(req.query.id);
	if (device === undefined) {
		res.status(400).send('Entered id not found');
		return;
	}

	try {
		const response = await NotificationService.Instance.sendTestMessage(
			device
		);
		res.status(200).json(response);
	} catch (error) {
		logger.error(error);
		res.sendStatus(400).send(
			'Error while sending test message, please check log file'
		);
		return;
	}
});
app.get('/boxDetails', (req, res) => {
	if (req.query.id === undefined) {
		res.sendStatus(404);
		return;
	}
	const device = MQTTService.Instance.getDeviceByID(req.query.id as string);

	if (device === undefined) {
		res.sendStatus(404);
		return;
	}

	res.status(200).json({
		lastEmptied: device.lastEmptied,
		history: device.history,
	});
});
app.post('/notServiceConf', async (req, res) => {
	if (req.body.cancel !== undefined) {
		res.redirect('/');
		return;
	}

	// Add password to body if it can't be changed if username hasn't been changed
	if (req.body.username === NotificationService.Instance.Config?.username) {
		if (!req.body.password) {
			req.body.password = NotificationService.Instance.Config?.password;
		}
	}
	req.body.port = req.body.port ? Number(req.body.port) : DEFAULT_SMTP_PORT;
	req.body.ssl = req.body.ssl === 'on';

	// TODO: Validate transporter with new config
	let isValid = await NotificationService.testConfig(req.body);
	if (!isValid) {
		// TODO: Send more information
		res.status(422).send('Connection to given SMTP Server not possible');
		logger.warn(
			'Newly added notification configuration not valid, will not update'
		);
		return;
	}

	try {
		NotificationService.Instance.updateConfig(req.body);
		res.redirect('/');
	} catch (error) {
		logger.error(error);
		res.status(400).send(
			'Error while updating config, please check log file'
		);
		return;
	}
});
app.post('/config-device', (req, res) => {
	if (req.body.cancel !== undefined) {
		res.status(200);
		res.redirect('/');
		return;
	}

	const device = MQTTService.Instance.getDeviceByID(req.body.id);
	if (device === undefined) {
		// Unexpected can't add new device from web
		res.sendStatus(500);
		logger.warn(
			`Can't configure device(${req.body.id}) because it has not been discoverd yet`
		);
		return;
	}

	if (req.body.delete !== undefined) {
		device.boxNumber = undefined;
		device.notificationBody = undefined;
		device.notificationTitle = undefined;
		device.subscriber = [];
		device.checkInterval = undefined;
		device.lastEmptied = undefined;
		device.history = [];

		logger.info(
			`device(${req.body.id}) as been deleted using the web interface`
		);
	} else {
		req.body.boxNumber = Number(req.body.boxNumber);
		if (isNaN(req.body.boxNumber)) {
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

	MQTTService.Instance.updateDevice(device);

	res.status(200);
	res.redirect('/');
});
//#endregion API

app.listen(PORT, () => {
	logger.info(`Server is running at http://localhost:${PORT}`);
});
