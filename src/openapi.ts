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
      url: 'https://survey-issue-tracker-api-production.up.railway.app',
      description: 'Production server',
    },
    {
      url: 'https://suited-enormously-donkey.ngrok-free.app',
      description: 'Development server',
    },
    {
      url: 'http://localhost:5000',
      description: 'Local server',
    },
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'Endpoint untuk autentikasi user',
    },
    {
      name: 'Users',
      description: 'Endpoint untuk manajemen user',
    },
    {
      name: 'Survey',
      description: 'Endpoint untuk data survey',
    },
    {
      name: 'Sync',
      description: 'Endpoint untuk sinkronisasi data dengan Google Sheets',
    },
    {
      name: 'Analytics',
      description: 'Endpoint untuk analytics data',
    },
    {
      name: 'Enums',
      description: 'Endpoint untuk mendapatkan enum values untuk filtering',
    }
  ],
};
