const dotenv = require('dotenv');

const envFile = process.env.npm_lifecycle_event === 'dev'
  ? '.env.development'
  : '.env';

const envResult = dotenv.config({ path: envFile });
if (envResult.error && envFile === '.env.development') {
  dotenv.config();
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./config/swagger');
const { getRedisClient } = require('./config/redis');
const { pool } = require('./config/database');
const logger = require('./utils/logger');
const formatError = require('./utils/formatError');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');

const app = express();

// -------------------------------------------------------
// Security & parsing
// -------------------------------------------------------
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(
  morgan(
    process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
    {
      stream: {
        write: (msg) => logger.info(msg.trim()),
      },
      skip: (req) => req.path === '/health',
    }
  )
);

// -------------------------------------------------------
// Rate limiting
// -------------------------------------------------------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    status: 429,
    code: 'RATE_LIMITED',
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

// -------------------------------------------------------
// Routes
// -------------------------------------------------------
app.use('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Task Tracker API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  })
);

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/tasks', apiLimiter, taskRoutes);
app.use('/api/v1/users', apiLimiter, userRoutes);
app.use('/api/v1/projects', apiLimiter, projectRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use(errorHandler);

// -------------------------------------------------------
// Boot
// -------------------------------------------------------
const PORT = parseInt(process.env.PORT) || 3000;

const start = async () => {
  // Connect to Redis eagerly (non-blocking)
  try {
    await getRedisClient().connect();
  } catch {
    logger.warn('Redis not available — caching disabled');
  }

  // Verify DB connection
  let dbConnected = false;

  try {
    await pool.query('SELECT 1');
    dbConnected = true;
    logger.info('PostgreSQL connected');
  } catch (err) {
    logger.error('Failed to connect to PostgreSQL', {
      error: formatError(err),
    });

    logger.warn('PostgreSQL unavailable. Starting server in limited mode.');
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Task Tracker API running on port ${PORT}`);

    if (dbConnected) {
      logger.info('Database connection active');
    } else {
      logger.warn('Database connection unavailable');
    }

    logger.info(`Swagger docs at http://localhost:${PORT}/api-docs`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(async () => {
      try {
        await pool.end();
      } catch {}

      try {
        await getRedisClient().quit();
      } catch {}

      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
};

start().catch((err) => {
  logger.error('Failed to start server', {
    error: formatError(err),
  });

  process.exit(1);
});

module.exports = app;