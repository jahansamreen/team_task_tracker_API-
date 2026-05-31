const { Pool } = require('pg');
const logger = require('../utils/logger');
const formatError = require('../utils/formatError');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'tasktracker',
  user:     process.env.DB_USER     || 'taskuser',
  password: process.env.DB_PASSWORD || 'taskpass',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: formatError(err) });
});

/**
 * Execute a parameterized query.
 * @param {string} text  - SQL string with $1, $2 placeholders
 * @param {Array}  params - Parameter values
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    logger.debug('DB query', { ms: Date.now() - start, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('DB query error', { error: formatError(err), query: text });
    throw err;
  }
};

/**
 * Grab a dedicated client for transactions.
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };