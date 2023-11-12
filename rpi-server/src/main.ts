import express, { Express, Request, Response } from 'express';
import { config } from 'dotenv';
import { IMQTTService, MQTTService } from './mqttService';
import { StateService, IStateService } from './status';
import { DEFAULT_SMTP_PORT, NotificationService } from './notification';

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

const stateService: IStateService = new StateService();

const mqttService: IMQTTService = new MQTTService();
mqttService.on('connectionChanged', (value) =>
	stateService.mqttOnlineStateChanged(value)
);
mqttService.on('deviceAdded', (device) => {
	device.on('occupiedChanged', (status) => {
		if (status) {
			NotificationService.Instance.sendMessage(
				device.subscriber,
				device.notificationTitle,
				device.notificationBody
			);
		}
	});
	stateService.addDeviceListener(device);
});
mqttService.connect();
//#endregion Setup

//#region API
app.get('/', (req: Request, res: Response) => {
	res.render('pages/index', {
		mailConf: {
			...NotificationService.Instance.Config,
			DEFAULT_SMTP_PORT,
		},
	});
});
app.post('/notServiceConf', async (req, res) => {
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
//#endregion API

app.listen(PORT, () => {
	console.log(`Server is running at http://localhost:${PORT}`);
});
