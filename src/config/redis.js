const Redis = require('ioredis');
const logger = require('../utils/logger');
const formatError = require('../utils/formatError');

let client;

const getRedisClient = () => {
  if (client) return client;

  client = new Redis({
    host:     process.env.REDIS_HOST     || '127.0.0.1',
    port:     parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    family:   4,
    retryStrategy: (times) => {
      if (times > 10) {
        logger.warn('Redis connection retry limit reached — cache disabled');
        return null; // Stop retrying
      }
      return Math.min(times * 200, 3000);
    },
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err) => logger.warn('Redis error', { error: formatError(err) }));
  client.on('close', () => logger.warn('Redis connection closed'));

  return client;
};

const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 300; // 5 minutes default

/**
 * Cache key builders — centralised so invalidation is consistent.
 */
const CacheKeys = {
  /** All tasks for an assignee within an org */
  tasksByAssignee: (orgId, assigneeId) =>
    `tasks:org:${orgId}:assignee:${assigneeId}`,

  /** Full task list for an org (used for ADMIN/MANAGER views) */
  tasksList: (orgId, query) =>
    `tasks:org:${orgId}:list:${JSON.stringify(query)}`,

  /** Single task */
  task: (taskId) => `task:${taskId}`,

  /** Pattern to match all task caches for an org */
  orgTasksPattern: (orgId) => `tasks:org:${orgId}:*`,

  /** Single task pattern */
  taskPattern: (taskId) => `task:${taskId}`,
};

/**
 * Get a cached value. Returns null on miss or Redis failure.
 */
const cacheGet = async (key) => {
  try {
    const redis = getRedisClient();
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null; // Degrade gracefully — never fail a request due to cache
  }
};

/**
 * Set a cached value with TTL (defaults to CACHE_TTL env var).
 */
const cacheSet = async (key, value, ttl = CACHE_TTL) => {
  try {
    const redis = getRedisClient();
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch {
    // Silently ignore — cache is non-critical
  }
};

/**
 * Delete one or more exact keys.
 */
const cacheDel = async (...keys) => {
  try {
    const redis = getRedisClient();
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Silently ignore
  }
};

/**
 * Delete all keys matching a glob pattern.
 * Uses SCAN to avoid blocking Redis with KEYS.
 */
const cacheDelPattern = async (pattern) => {
  try {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) pipeline.del(...keys);
    } while (cursor !== '0');
    await pipeline.exec();
  } catch {
    // Silently ignore
  }
};

module.exports = {
  getRedisClient,
  CacheKeys,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  CACHE_TTL,
};