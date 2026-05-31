const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES_IN  || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Sign a short-lived access token containing the user's id, role, and org.
 */
const signAccessToken = (payload) =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });

/**
 * Sign a long-lived refresh token (opaque — payload is just the user id).
 */
const signRefreshToken = (userId) =>
  jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });

const verifyAccessToken = (token) =>
  jwt.verify(token, ACCESS_SECRET);

const verifyRefreshToken = (token) =>
  jwt.verify(token, REFRESH_SECRET);

/**
 * Hash a refresh token before storing — so a DB leak doesn't give attackers live tokens.
 */
const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  REFRESH_EXPIRES,
};