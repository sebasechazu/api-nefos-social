import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'src/utils/logs/combined.log' }),
        new winston.transports.File({ filename: 'src/utils/logs/error.log', level: 'error' })
    ]
});

export default logger;
