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

const stateService: IStateService = new StateService();

const mqttService: IMQTTService = new MQTTService();
mqttService.onConnectionStateChanged(stateService.mqttOnlineStateChanged);
mqttService.connect();

mqttService.devices.forEach((device) => {
	device.onOccupiedChanged((status) => {
		if (status)
			// Every device has it's own notification information saved
			sendMessage(
				device.subscriber,
				device.notificationTitle,
				device.notificationBody
			);
	});
});
//#endregion Setup

//#region API
app.get('/', (req: Request, res: Response) => {
	res.send('Express + TypeScript Server');
});
//#endregion API

app.listen(PORT, () => {
	console.log(`Server is running at http://localhost:${PORT}`);
});
