const { query } = require('../config/database');

const listUsers = async (organizationId) => {
  const result = await query(
    `SELECT id, email, full_name, role, is_active, created_at
     FROM users WHERE organization_id = $1 ORDER BY full_name`,
    [organizationId]
  );
  return result.rows;
};

const getUserById = async (userId, organizationId) => {
  const result = await query(
    `SELECT id, email, full_name, role, is_active, created_at
     FROM users WHERE id = $1 AND organization_id = $2`,
    [userId, organizationId]
  );
  return result.rows[0] || null;
};

const updateUserRole = async (userId, organizationId, role, requesterId) => {
  if (userId === requesterId) {
    const err = new Error('You cannot change your own role');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const result = await query(
    `UPDATE users SET role = $1
     WHERE id = $2 AND organization_id = $3
     RETURNING id, email, full_name, role, is_active`,
    [role, userId, organizationId]
  );
  return result.rows[0] || null;
};

const deactivateUser = async (userId, organizationId, requesterId) => {
  if (userId === requesterId) {
    const err = new Error('You cannot deactivate your own account');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const result = await query(
    `UPDATE users SET is_active = false WHERE id = $1 AND organization_id = $2 RETURNING id`,
    [userId, organizationId]
  );
  return result.rowCount > 0;
};

module.exports = { listUsers, getUserById, updateUserRole, deactivateUser };