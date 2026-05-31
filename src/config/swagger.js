const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Task Tracker API',
      version: '1.0.0',
      description: `
## Team Task Tracker REST API

A backend API for managing tasks within a team. Features:
- JWT authentication with refresh token rotation
- Role-Based Access Control (ADMIN / MANAGER / MEMBER)
- Task state machine with enforced transitions
- Redis caching per assignee
- Analytics endpoint

### Default Seed Users (password: \`Password123!\`)
| Email | Role |
|---|---|
| admin@acme.com | ADMIN |
| manager@acme.com | MANAGER |
| member@acme.com | MEMBER |
      `,
      contact: { name: 'API Support' },
    },
    servers: [
      { url: 'http://localhost:3000/api/v1', description: 'Local / Docker' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status:  { type: 'integer' },
            code:    { type: 'string' },
            message: { type: 'string' },
            errors:  { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
    tags: [
      { name: 'Auth',     description: 'Authentication & token management' },
      { name: 'Tasks',    description: 'Task CRUD & transitions' },
      { name: 'Projects', description: 'Project management' },
      { name: 'Users',    description: 'User management (ADMIN)' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;