const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  REFRESH_EXPIRES,
} = require('../utils/jwt');

const SALT_ROUNDS = 10;

/**
 * Parse "7d" / "15m" style expiry strings into a JS Date offset.
 */
const expiryToDate = (expiresIn) => {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid expiresIn format: ${expiresIn}`);
  const [, amount, unit] = match;
  const ms = { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3 }[unit];
  return new Date(Date.now() + parseInt(amount) * ms);
};

/**
 * Register a new user.
 * If organization_id is provided, joins that org.
 * Otherwise creates a new org from organization_name.
 */
const register = async ({ email, password, full_name, organization_name, organization_id, invite_role }) => {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  let orgId = organization_id;

  if (!orgId) {
    // Create new organization
    const slug = organization_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 100);

    const slugUnique = `${slug}-${Date.now()}`;
    const orgResult = await query(
      'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id',
      [organization_name, slugUnique]
    );
    orgId = orgResult.rows[0].id;
  } else {
    // Verify org exists
    const orgCheck = await query('SELECT id FROM organizations WHERE id = $1', [orgId]);
    if (orgCheck.rows.length === 0) {
      const err = new Error('Organization not found');
      err.statusCode = 404;
      throw err;
    }
  }

  // First user in org gets ADMIN; subsequent users get invite_role
  const existingUsers = await query(
    'SELECT COUNT(*) as count FROM users WHERE organization_id = $1',
    [orgId]
  );
  const isFirstUser = parseInt(existingUsers.rows[0].count) === 0;
  const role = isFirstUser ? 'ADMIN' : (invite_role || 'MEMBER');

  const userResult = await query(
    `INSERT INTO users (organization_id, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, full_name, role, organization_id, created_at`,
    [orgId, email, passwordHash, full_name, role]
  );

  const user = userResult.rows[0];
  const tokens = await generateTokenPair(user);

  return { user: sanitizeUser(user), ...tokens };
};

/**
 * Login with email + password.
 */
const login = async ({ email, password }) => {
  const result = await query(
    `SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.organization_id, u.is_active
     FROM users u WHERE u.email = $1`,
    [email]
  );

  const user = result.rows[0];
  if (!user || !user.is_active) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const tokens = await generateTokenPair(user);
  return { user: sanitizeUser(user), ...tokens };
};

/**
 * Exchange a valid refresh token for a new token pair (rotation).
 * The old refresh token is immediately revoked.
 */
const refreshTokens = async (rawToken) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(rawToken);
  } catch {
    const err = new Error('Invalid or expired refresh token');
    err.statusCode = 401;
    err.code = 'TOKEN_INVALID';
    throw err;
  }

  const hash = hashToken(rawToken);
  const tokenRow = await query(
    `SELECT rt.id, rt.revoked, u.id as user_id, u.email, u.role, u.organization_id, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`,
    [hash]
  );

  const row = tokenRow.rows[0];
  if (!row || row.revoked || !row.is_active) {
    // Possible token reuse — revoke ALL tokens for this user (security measure)
    await query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [decoded.sub]);
    const err = new Error('Refresh token is invalid or has been revoked');
    err.statusCode = 401;
    err.code = 'TOKEN_INVALID';
    throw err;
  }

  // Revoke the used token
  await query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [row.id]);

  const user = {
    id:             row.user_id,
    email:          row.email,
    role:           row.role,
    organization_id: row.organization_id,
  };

  const tokens = await generateTokenPair(user);
  return tokens;
};

/**
 * Revoke a refresh token (logout).
 */
const revokeToken = async (rawToken) => {
  const hash = hashToken(rawToken);
  await query('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1', [hash]);
};

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

const generateTokenPair = async (user) => {
  const accessToken = signAccessToken({
    id:             user.id,
    email:          user.email,
    role:           user.role,
    organizationId: user.organization_id,
  });

  const refreshToken = signRefreshToken(user.id);
  const hash = hashToken(refreshToken);
  const expiresAt = expiryToDate(REFRESH_EXPIRES);

  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, hash, expiresAt]
  );

  return { access_token: accessToken, refresh_token: refreshToken };
};

const sanitizeUser = (user) => ({
  id:              user.id,
  email:           user.email,
  full_name:       user.full_name,
  role:            user.role,
  organization_id: user.organization_id,
  created_at:      user.created_at,
});

module.exports = { register, login, refreshTokens, revokeToken };