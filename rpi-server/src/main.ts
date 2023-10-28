import express, {Express, Request, Response} from 'express';

const PORT = 8080;

const app: Express = express();

app.get('/', (req: Request, res: Response) => {
	res.send('Express + TypeScript Server');
});

app.listen(PORT, () => {
	console.log(`Server is running at http://localhost:${PORT}`);
})