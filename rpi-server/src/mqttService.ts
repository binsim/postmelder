import { connect } from 'mqtt';

let client = connect('mqtt://mqtt', {
	username: process.env.MQTT_USERNAME,
	password: process.env.MQTT_PASSWORD,
});

client.on('error', (err: Error) => {
	console.error(err.message);
});

client.on('connect', () => {});

client.on('message', (topic: string, payload: Buffer) => {
	switch (topic) {
		default:
			console.error(`"${topic}" is not implemented yet`);
			return;
	}
});
