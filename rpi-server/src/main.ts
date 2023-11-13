import express, { Express, Request, Response } from 'express';
import { config } from 'dotenv';
import { IMQTTService, MQTTService } from './mqttService';
import { StateService, IStateService } from './status';
import { DEFAULT_SMTP_PORT, NotificationService } from './notification';
import { CheckInterals, IDevice } from './EspDevice';

//#region Setup
// Importend for using .env variables
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

const mqttService: IMQTTService = new MQTTService();
mqttService.on('connectionChanged', (value) =>
	stateService.mqttOnlineStateChanged(value)
);
mqttService.on('deviceAdded', (device) => {
	NotificationService.Instance.addDevice(device);
	stateService.addDeviceListener(device);
});
mqttService.connect();
//#endregion Setup

//#region API
app.get('/', (req: Request, res: Response) => {
	let devices;
	{
		const configured: IDevice[] = [];
		const toConfigure: IDevice[] = [];

		mqttService.devices.forEach((device) => {
			if (device.isCompletelyConfiguerd) {
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
			checkinterval: CheckInterals,
			DEFAULT_SMTP_PORT,
		},
		mailConf: {
			...NotificationService.Instance.Config,
		},
	});
});
app.get('/testMessage', async (req, res) => {
	console.log({ query: req.query });
	if (typeof req.query.id !== 'string') {
		res.status(400).send('ID is not a string');
		return;
	}
	const device = mqttService.getDeviceByID(req.query.id);
	if (device === undefined) {
		res.status(400).send('Entered id not found');
		return;
	}

	const response = await NotificationService.Instance.sendTestMessage(device);
	console.log(response);
	res.status(200).json(response);
});
app.post('/notServiceConf', async (req, res) => {
	if (req.body.cancle !== undefined) {
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
		return;
	}

	try {
		NotificationService.Instance.updateConfig(req.body);
		res.redirect('/');
		return;
	} catch (error) {}

	// TODO: Update Status
	res.sendStatus(501);

	console.log({ body: req.body });
});
app.post('/config-device', (req, res) => {
	if (req.body.cancle !== undefined) {
		res.status(200);
		res.redirect('/');
		return;
	}

	const device = mqttService.getDeviceByID(req.body.id);
	if (device === undefined) {
		// Unexpected can't add new device from web
		res.sendStatus(500);
		return;
	}

	if (req.body.delete !== undefined) {
		device.boxNumber = undefined;
		device.notificationBody = undefined;
		device.notificationTitle = undefined;
		device.subscriber = undefined;
		device.checkInterval = undefined;
	} else {
		req.body.boxnumber = Number(req.body.boxnumber);
		if (isNaN(req.body.boxnumber)) {
			res.status(400).json({
				...req.body,
				error: 'boxNumber not a number',
			});
			return;
		}

		// Updating the device info
		device.boxNumber = req.body.boxnumber;
		device.notificationBody = req.body.body;
		device.notificationTitle = req.body.subject;
		device.subscriber = req.body.to.split('; ');
		device.checkInterval = req.body.checkinterval;
	}

	mqttService.updateDevice(device);

	res.status(200);
	res.redirect('/');
});
//#endregion API

app.listen(PORT, () => {
	console.log(`Server is running at http://localhost:${PORT}`);
});
