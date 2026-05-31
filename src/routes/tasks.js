const router = require('express').Router();
const ctrl   = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const { requireMinRole, requireRole } = require('../middleware/rbac');
const { validate, validateQuery } = require('../middleware/validate');
const {
  createTaskSchema, updateTaskSchema, transitionTaskSchema, listTasksQuerySchema
} = require('../validators/schemas');

// All task routes require authentication
router.use(authenticate);

/**
 * @openapi
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks (paginated, filterable)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED] }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [LOW, MEDIUM, HIGH] }
 *       - in: query
 *         name: assignee_id
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/',
  validateQuery(listTasksQuerySchema),
  ctrl.listTasks
);

/**
 * @openapi
 * /tasks/analytics:
 *   get:
 *     tags: [Tasks]
 *     summary: Overdue count per user + average completion time (MANAGER/ADMIN)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/analytics',
  requireMinRole('MANAGER'),
  ctrl.getAnalytics
);

/**
 * @openapi
 * /tasks/{id}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get a single task by ID
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', ctrl.getTask);

/**
 * @openapi
 * /tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Create a new task (MANAGER/ADMIN only)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/',
  requireMinRole('MANAGER'),
  validate(createTaskSchema),
  ctrl.createTask
);

/**
 * @openapi
 * /tasks/{id}:
 *   patch:
 *     tags: [Tasks]
 *     summary: Update task fields (assignee can update their own; MANAGER/ADMIN can update any)
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  validate(updateTaskSchema),
  ctrl.updateTask
);

/**
 * @openapi
 * /tasks/{id}/transition:
 *   post:
 *     tags: [Tasks]
 *     summary: Transition task status (enforced state machine)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/transition',
  validate(transitionTaskSchema),
  ctrl.transitionTask
);

/**
 * @openapi
 * /tasks/{id}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task (ADMIN only)
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  '/:id',
  requireRole('ADMIN'),
  ctrl.deleteTask
);

module.exports = router;