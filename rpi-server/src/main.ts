import express, { Express, Request, Response } from 'express';
import { config } from 'dotenv';
import { IMQTTService, MQTTService } from './mqttService';
import { setState } from './status';

//#region Setup
// Importend for using .env variables
config();
const PORT = 8080;
const app: Express = express();

const mqttService: IMQTTService = new MQTTService();
mqttService.connect();
//#endregion Setup

let connectionTestIntervall: NodeJS.Timeout = setInterval(() => {
	if (!mqttService.isConnected) {
		setState('networkError');
	}
}, 10_000);
//#region API
app.get('/', (req: Request, res: Response) => {
	res.send('Express + TypeScript Server');
});
//#endregion API

app.listen(PORT, () => {
	console.log(`Server is running at http://localhost:${PORT}`);
});
