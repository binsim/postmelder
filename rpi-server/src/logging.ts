import winston, { createLogger } from 'winston';

const enumerateErrorFormat = winston.format((info) => {
	if (info instanceof Error) {
		Object.assign(info, { message: info.stack });
	}
	return info;
});

// At least one transport has to be defined, otherwise it may cause some unwanted results
const transports: winston.transport[] = [
	new winston.transports.File({
		filename: `data/${new Date(Date.now()).toDateString()}.log`,
	}),
];
// Do not write to console for test, it will bloat the output unnecessary
if (process.env.NODE_ENV !== 'test') {
	transports.push(
		new winston.transports.Console({
			stderrLevels: ['error'],
		})
	);
}

// Create the logger instance for usage
export const logger = createLogger({
	level: process.env.LOG_LEVEL ?? 'debug',
	format: winston.format.combine(
		enumerateErrorFormat(),
		winston.format.printf(({ level, message }) => `${level}: ${message}`)
	),
	transports,
});
