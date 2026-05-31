const { query } = require('../config/database');

const listProjects = async (organizationId) => {
  const result = await query(
    `SELECT p.*, u.full_name as created_by_name
     FROM projects p
     JOIN users u ON u.id = p.created_by
     WHERE p.organization_id = $1 ORDER BY p.created_at DESC`,
    [organizationId]
  );
  return result.rows;
};

const getProjectById = async (projectId, organizationId) => {
  const result = await query(
    `SELECT p.*, u.full_name as created_by_name
     FROM projects p
     JOIN users u ON u.id = p.created_by
     WHERE p.id = $1 AND p.organization_id = $2`,
    [projectId, organizationId]
  );
  return result.rows[0] || null;
};

const createProject = async ({ organizationId, userId, name, description }) => {
  const result = await query(
    `INSERT INTO projects (organization_id, name, description, created_by)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [organizationId, name, description || null, userId]
  );
  return result.rows[0];
};

const updateProject = async (projectId, organizationId, { name, description }) => {
  const result = await query(
    `UPDATE projects SET
      name        = COALESCE($3, name),
      description = COALESCE($4, description)
     WHERE id = $1 AND organization_id = $2 RETURNING *`,
    [projectId, organizationId, name || null, description !== undefined ? description : null]
  );
  return result.rows[0] || null;
};

const deleteProject = async (projectId, organizationId) => {
  const result = await query(
    'DELETE FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );
  return result.rowCount > 0;
};

module.exports = { listProjects, getProjectById, createProject, updateProject, deleteProject };