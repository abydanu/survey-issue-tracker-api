export const openApiConfig = {
  openapi: '3.0.0',
  info: {
    title: 'Survey Issue Tracking API',
    version: '1.0.0',
    description: 'API Documentation untuk Survey Issue Tracking System',
    contact: {
      name: 'API Support',
      email: 'support@sit.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local server',
    },
    {
      url: 'https://suited-enormously-donkey.ngrok-free.app',
      description: 'Development server',
    },
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'Endpoint untuk autentikasi user',
    },
  ],
};
