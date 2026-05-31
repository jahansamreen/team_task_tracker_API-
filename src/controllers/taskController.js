const taskService = require('../services/taskService');
const { successResponse, errorResponse, ErrorCodes } = require('../utils/response');

const listTasks = async (req, res, next) => {
  try {
    const result = await taskService.listTasks({
      organizationId: req.user.organizationId,
      userId:         req.user.id,
      userRole:       req.user.role,
      filters:        req.query,
    });
    return successResponse(res, 200, result.tasks, result.pagination);
  } catch (err) { next(err); }
};

const getTask = async (req, res, next) => {
  try {
    const task = await taskService.getTaskById(req.params.id, req.user.organizationId);
    if (!task) {
      return errorResponse(res, 404, ErrorCodes.NOT_FOUND, 'Task not found');
    }

    // MEMBER: only their own tasks
    if (req.user.role === 'MEMBER' && task.assignee_id !== req.user.id) {
      return errorResponse(res, 403, ErrorCodes.FORBIDDEN, 'You can only view tasks assigned to you');
    }

    return successResponse(res, 200, task);
  } catch (err) { next(err); }
};

const createTask = async (req, res, next) => {
  try {
    const task = await taskService.createTask({
      organizationId: req.user.organizationId,
      userId:         req.user.id,
      data:           req.body,
    });
    return successResponse(res, 201, task);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.statusCode, err.code, err.message);
    }
    next(err);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const task = await taskService.updateTask({
      taskId:         req.params.id,
      organizationId: req.user.organizationId,
      data:           req.body,
      userRole:       req.user.role,
      userId:         req.user.id,
    });

    if (!task) {
      return errorResponse(res, 404, ErrorCodes.NOT_FOUND, 'Task not found');
    }
    return successResponse(res, 200, task);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.statusCode, err.code, err.message);
    }
    next(err);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const deleted = await taskService.deleteTask(req.params.id, req.user.organizationId);
    if (!deleted) {
      return errorResponse(res, 404, ErrorCodes.NOT_FOUND, 'Task not found');
    }
    return successResponse(res, 200, { message: 'Task deleted successfully' });
  } catch (err) { next(err); }
};

const transitionTask = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const result = await taskService.transitionTask({
      taskId:         req.params.id,
      organizationId: req.user.organizationId,
      newStatus:      status,
      note,
      userId:         req.user.id,
      userRole:       req.user.role,
    });

    if (result.error === 'NOT_FOUND') {
      return errorResponse(res, 404, ErrorCodes.NOT_FOUND, 'Task not found');
    }
    if (result.error === 'FORBIDDEN') {
      return errorResponse(res, 403, ErrorCodes.FORBIDDEN, 'Only the assignee or a manager can change task status');
    }
    if (result.error === 'INVALID_TRANSITION') {
      return errorResponse(
        res, 400, ErrorCodes.INVALID_TRANSITION,
        `Invalid status transition from ${result.from} to ${result.to}`
      );
    }

    return successResponse(res, 200, result.task);
  } catch (err) { next(err); }
};

const getAnalytics = async (req, res, next) => {
  try {
    const data = await taskService.getAnalytics(req.user.organizationId);
    return successResponse(res, 200, data);
  } catch (err) { next(err); }
};

module.exports = { listTasks, getTask, createTask, updateTask, deleteTask, transitionTask, getAnalytics };