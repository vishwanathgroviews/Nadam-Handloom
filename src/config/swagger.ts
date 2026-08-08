import swaggerJSDoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NandamHandlooms Auth & Authorization API',
      version: '1.0.0',
      description: 'Headless authentication & authorization REST API.',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [path.join(__dirname, '..', 'modules', '**', '*.routes.ts')],
};

export const swaggerSpec = swaggerJSDoc(options);
