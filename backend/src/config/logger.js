import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logDir = path.join(__dirname, '../../logs');

// Create custom format
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    const serviceStr = service ? `[${service}] ` : '';
    return `${timestamp} ${level}: ${serviceStr}${message} ${metaStr}`;
  })
);

// Base logger configuration
const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'xervean-backend' },
  transports: [
    // Write all logs to console in development
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'error' : 'debug'
    })
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console({ format: consoleFormat })
  ],
  rejectionHandlers: [
    new winston.transports.Console({ format: consoleFormat })
  ]
});

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  baseLogger.add(new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));

  baseLogger.add(new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

// Create logger factory
export function createLogger(service) {
  return baseLogger.child({ service });
}

export default baseLogger;
