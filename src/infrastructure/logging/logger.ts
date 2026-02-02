import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

const logger = pino({
  level: isProd ? 'info' : 'debug',
  timestamp: () => `,"timestamp":"${new Date().toISOString().replace('T', ' ').slice(0, 19)}"`,
  formatters: {
    level(label) {
      return { level: label.toUpperCase() };
    },
  },
  messageKey: 'message',
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        },
      }),
});

export default logger;
