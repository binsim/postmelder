import express, { Express, Request, Response } from 'express';
import { config } from 'dotenv';
import './mqttService';

// Importend for using .env variables
config();

const PORT = 8080;

const app: Express = express();

app.get('/', (req: Request, res: Response) => {
	res.send('Express + TypeScript Server');
});

app.listen(PORT, () => {
	console.log(`Server is running at http://localhost:${PORT}`);
});
