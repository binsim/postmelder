import express, { Express, Request, Response } from 'express';
import { config } from 'dotenv';
import { IMQTTService, MQTTService } from './mqttService';
import { sendMessage } from './notification';
import { StateService, IStateService } from './status';

//#region Setup
// Importend for using .env variables
config();
const PORT = 8080;
const app: Express = express();

// set the view engine to ejs
app.set('view engine', 'ejs');

const stateService: IStateService = new StateService();

const mqttService: IMQTTService = new MQTTService();
mqttService.onConnectionStateChanged(stateService.mqttOnlineStateChanged);
mqttService.onDeviceAdded((device) => {
	device.onOccupiedChanged((status) => {
		if (status) {
			sendMessage(
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
	res.render('pages/index');
});
//#endregion API

app.listen(PORT, () => {
	console.log(`Server is running at http://localhost:${PORT}`);
});
