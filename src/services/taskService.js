const { query, getClient } = require('../config/database');
const { cacheGet, cacheSet, cacheDelPattern, cacheDel, CacheKeys } = require('../config/redis');
const { isValidTransition } = require('../utils/transitions');

// -------------------------------------------------------
// List Tasks
// -------------------------------------------------------

/**
 * List tasks with pagination and filtering.
 * Results per assignee are cached in Redis.
 */
const listTasks = async ({ organizationId, userId, userRole, filters }) => {
  const { page, limit, status, priority, assignee_id, project_id, search, sort_by, sort_dir } = filters;
  const offset = (page - 1) * limit;

  // MEMBER: can only see their own tasks
  const effectiveAssigneeId =
    userRole === 'MEMBER' ? userId : (assignee_id || null);

  // Build cache key
  const cacheKey = effectiveAssigneeId
    ? CacheKeys.tasksByAssignee(organizationId, effectiveAssigneeId)
    : CacheKeys.tasksList(organizationId, filters);

  // Attempt cache hit — only cache non-search, non-paginated queries for simplicity
  // (search and large paginated results would bloat the cache)
  const shouldCache = !search && page <= 5;
  if (shouldCache) {
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;
  }

  // Build dynamic WHERE clauses
  const conditions = ['t.organization_id = $1'];
  const params = [organizationId];
  let idx = 2;

  if (effectiveAssigneeId) {
    conditions.push(`t.assignee_id = $${idx++}`);
    params.push(effectiveAssigneeId);
  }
  if (status) {
    conditions.push(`t.status = $${idx++}`);
    params.push(status);
  }
  if (priority) {
    conditions.push(`t.priority = $${idx++}`);
    params.push(priority);
  }
  if (project_id) {
    conditions.push(`t.project_id = $${idx++}`);
    params.push(project_id);
  }
  if (search) {
    conditions.push(`(t.title ILIKE $${idx} OR t.description ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  // Whitelist sort_by to prevent SQL injection
  const sortColumn = {
    created_at: 't.created_at',
    updated_at: 't.updated_at',
    due_date:   't.due_date',
    priority:   `CASE t.priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END`,
  }[sort_by] || 't.created_at';

  const sortDirection = sort_dir === 'asc' ? 'ASC' : 'DESC';
  const whereClause = conditions.join(' AND ');

  const dataQuery = `
    SELECT
      t.id, t.title, t.description, t.priority, t.status,
      t.due_date, t.created_at, t.updated_at, t.completed_at,
      t.assignee_id, t.project_id, t.created_by,
      json_build_object(
        'id', a.id, 'full_name', a.full_name, 'email', a.email
      ) AS assignee,
      json_build_object(
        'id', p.id, 'name', p.name
      ) AS project
    FROM tasks t
    LEFT JOIN users a ON a.id = t.assignee_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE ${whereClause}
    ORDER BY ${sortColumn} ${sortDirection} NULLS LAST
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const countQuery = `SELECT COUNT(*) FROM tasks t WHERE ${whereClause}`;

  const [dataResult, countResult] = await Promise.all([
    query(dataQuery, [...params, limit, offset]),
    query(countQuery, params),
  ]);

  const total = parseInt(countResult.rows[0].count);
  const result = {
    tasks: dataResult.rows.map(cleanAssigneeNull),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
      has_next:    page * limit < total,
      has_prev:    page > 1,
    },
  };

  if (shouldCache) {
    await cacheSet(cacheKey, result);
  }

  return result;
};

// -------------------------------------------------------
// Get Single Task
// -------------------------------------------------------

const getTaskById = async (taskId, organizationId) => {
  const cacheKey = CacheKeys.task(taskId);
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const result = await query(
    `SELECT
      t.*,
      json_build_object('id', a.id, 'full_name', a.full_name, 'email', a.email) AS assignee,
      json_build_object('id', p.id, 'name', p.name) AS project,
      json_build_object('id', cb.id, 'full_name', cb.full_name) AS created_by_user
    FROM tasks t
    LEFT JOIN users a  ON a.id  = t.assignee_id
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN users cb ON cb.id = t.created_by
    WHERE t.id = $1 AND t.organization_id = $2`,
    [taskId, organizationId]
  );

  if (result.rows.length === 0) return null;
  const task = cleanAssigneeNull(result.rows[0]);
  await cacheSet(cacheKey, task, 60); // 1-minute TTL for single task
  return task;
};

// -------------------------------------------------------
// Create Task
// -------------------------------------------------------

const createTask = async ({ organizationId, userId, data }) => {
  const { title, description, priority, assignee_id, project_id, due_date } = data;

  if (assignee_id) await assertUserInOrg(assignee_id, organizationId);
  if (project_id)  await assertProjectInOrg(project_id, organizationId);

  const result = await query(
    `INSERT INTO tasks
       (organization_id, title, description, priority, assignee_id, project_id, due_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [organizationId, title, description || null, priority, assignee_id || null,
     project_id || null, due_date || null, userId]
  );

  const task = result.rows[0];

  // Invalidate org-level list caches
  await invalidateOrgCache(organizationId);
  if (assignee_id) {
    await cacheDel(CacheKeys.tasksByAssignee(organizationId, assignee_id));
  }

  return task;
};

// -------------------------------------------------------
// Update Task
// -------------------------------------------------------

const updateTask = async ({ taskId, organizationId, data, userRole, userId }) => {
  const existing = await getTaskRaw(taskId, organizationId);
  if (!existing) return null;

  // MEMBER can only update tasks assigned to them
  if (userRole === 'MEMBER' && existing.assignee_id !== userId) {
    const err = new Error('You can only update tasks assigned to you');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const { title, description, priority, assignee_id, project_id, due_date } = data;

  if (assignee_id !== undefined && assignee_id !== null) {
    await assertUserInOrg(assignee_id, organizationId);
  }
  if (project_id !== undefined && project_id !== null) {
    await assertProjectInOrg(project_id, organizationId);
  }

  const result = await query(
    `UPDATE tasks SET
      title       = COALESCE($3, title),
      description = COALESCE($4, description),
      priority    = COALESCE($5, priority),
      assignee_id = CASE WHEN $6::boolean THEN $7 ELSE assignee_id END,
      project_id  = CASE WHEN $8::boolean THEN $9 ELSE project_id END,
      due_date    = CASE WHEN $10::boolean THEN $11 ELSE due_date END
    WHERE id = $1 AND organization_id = $2
    RETURNING *`,
    [
      taskId, organizationId,
      title       !== undefined ? title       : null,
      description !== undefined ? description : null,
      priority    !== undefined ? priority    : null,
      'assignee_id' in data, assignee_id !== undefined ? assignee_id : null,
      'project_id'  in data, project_id  !== undefined ? project_id  : null,
      'due_date'    in data, due_date     !== undefined ? due_date    : null,
    ]
  );

  if (result.rows.length === 0) return null;
  await invalidateTaskCache(taskId, organizationId, existing.assignee_id, assignee_id);
  return result.rows[0];
};

// -------------------------------------------------------
// Delete Task
// -------------------------------------------------------

const deleteTask = async (taskId, organizationId) => {
  const existing = await getTaskRaw(taskId, organizationId);
  if (!existing) return false;

  await query('DELETE FROM tasks WHERE id = $1 AND organization_id = $2', [taskId, organizationId]);
  await invalidateTaskCache(taskId, organizationId, existing.assignee_id);
  return true;
};

// -------------------------------------------------------
// Status Transition
// -------------------------------------------------------

/**
 * Transition a task's status.
 * Enforces the allowed transition graph.
 * Only the assignee OR a MANAGER/ADMIN can advance status.
 */
const transitionTask = async ({ taskId, organizationId, newStatus, note, userId, userRole }) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const taskResult = await client.query(
      'SELECT * FROM tasks WHERE id = $1 AND organization_id = $2 FOR UPDATE',
      [taskId, organizationId]
    );

    if (taskResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { error: 'NOT_FOUND', task: null };
    }

    const task = taskResult.rows[0];

    // Permission: assignee OR manager/admin
    const isAssignee = task.assignee_id === userId;
    const isElevated = ['MANAGER', 'ADMIN'].includes(userRole);
    if (!isAssignee && !isElevated) {
      await client.query('ROLLBACK');
      return { error: 'FORBIDDEN', task: null };
    }

    if (!isValidTransition(task.status, newStatus)) {
      await client.query('ROLLBACK');
      return {
        error: 'INVALID_TRANSITION',
        task: null,
        from: task.status,
        to: newStatus,
      };
    }

    const completedAt = newStatus === 'DONE' ? new Date() : task.completed_at;

    const updated = await client.query(
      `UPDATE tasks SET status = $1, completed_at = $2 WHERE id = $3 RETURNING *`,
      [newStatus, completedAt, taskId]
    );

    await client.query(
      `INSERT INTO task_status_history (task_id, from_status, to_status, changed_by, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [taskId, task.status, newStatus, userId, note || null]
    );

    await client.query('COMMIT');

    const updatedTask = updated.rows[0];
    await invalidateTaskCache(taskId, organizationId, updatedTask.assignee_id);
    return { error: null, task: updatedTask };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// -------------------------------------------------------
// Analytics (Bonus)
// -------------------------------------------------------

const getAnalytics = async (organizationId) => {
  const [overdueResult, completionResult] = await Promise.all([
    query(
      `SELECT
         u.id, u.full_name, u.email,
         COUNT(*) FILTER (WHERE t.due_date < NOW() AND t.status != 'DONE') AS overdue_count
       FROM users u
       LEFT JOIN tasks t ON t.assignee_id = u.id AND t.organization_id = $1
       WHERE u.organization_id = $1
       GROUP BY u.id, u.full_name, u.email
       ORDER BY overdue_count DESC`,
      [organizationId]
    ),
    query(
      `SELECT
         AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600) AS avg_completion_hours,
         COUNT(*) AS total_completed
       FROM tasks
       WHERE organization_id = $1 AND status = 'DONE' AND completed_at IS NOT NULL`,
      [organizationId]
    ),
  ]);

  return {
    overdue_by_user: overdueResult.rows,
    avg_completion_hours: parseFloat(completionResult.rows[0].avg_completion_hours) || 0,
    total_completed:      parseInt(completionResult.rows[0].total_completed),
  };
};

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

const getTaskRaw = async (taskId, organizationId) => {
  const result = await query(
    'SELECT * FROM tasks WHERE id = $1 AND organization_id = $2',
    [taskId, organizationId]
  );
  return result.rows[0] || null;
};

const assertUserInOrg = async (userId, organizationId) => {
  const r = await query(
    'SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND is_active = true',
    [userId, organizationId]
  );
  if (r.rows.length === 0) {
    const err = new Error('Assignee must be an active member of your organization');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
};

const assertProjectInOrg = async (projectId, organizationId) => {
  const r = await query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );
  if (r.rows.length === 0) {
    const err = new Error('Project does not exist in your organization');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
};

/**
 * Invalidate all task list caches for an org + the specific task cache.
 */
const invalidateTaskCache = async (taskId, organizationId, ...assigneeIds) => {
  await Promise.all([
    cacheDel(CacheKeys.task(taskId)),
    cacheDelPattern(CacheKeys.orgTasksPattern(organizationId)),
    ...assigneeIds
      .filter(Boolean)
      .map((id) => cacheDel(CacheKeys.tasksByAssignee(organizationId, id))),
  ]);
};

const invalidateOrgCache = async (organizationId) =>
  cacheDelPattern(CacheKeys.orgTasksPattern(organizationId));

const cleanAssigneeNull = (row) => {
  if (row.assignee && row.assignee.id === null) row.assignee = null;
  if (row.project  && row.project.id  === null) row.project  = null;
  return row;
};

module.exports = {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  transitionTask,
  getAnalytics,
};