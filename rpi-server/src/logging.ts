import winston, { createLogger } from 'winston';

const enumerateErrorFormat = winston.format((info) => {
	if (info instanceof Error) {
		Object.assign(info, { message: info.stack });
	}
	return info;
});

const transports: winston.transport[] = [
	new winston.transports.File({
		filename: `data/${new Date(Date.now()).toDateString()}.log`,
	}),
];
if (process.env.NODE_ENV !== 'test') {
	transports.push(
		new winston.transports.Console({
			stderrLevels: ['error'],
		})
	);
}

export const logger = createLogger({
	level: process.env.LOG_LEVEL ?? 'debug',
	format: winston.format.combine(
		enumerateErrorFormat(),
		// winston.format.colorize(),
		winston.format.printf(({ level, message }) => `${level}: ${message}`)
	),
	transports,
});
