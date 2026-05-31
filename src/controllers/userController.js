const userService = require('../services/userService');
const { successResponse, errorResponse, ErrorCodes } = require('../utils/response');

const listUsers = async (req, res, next) => {
  try {
    const users = await userService.listUsers(req.user.organizationId);
    return successResponse(res, 200, users);
  } catch (err) { next(err); }
};

const getUser = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id, req.user.organizationId);
    if (!user) return errorResponse(res, 404, ErrorCodes.NOT_FOUND, 'User not found');
    return successResponse(res, 200, user);
  } catch (err) { next(err); }
};

const updateRole = async (req, res, next) => {
  try {
    const user = await userService.updateUserRole(
      req.params.id, req.user.organizationId, req.body.role, req.user.id
    );
    if (!user) return errorResponse(res, 404, ErrorCodes.NOT_FOUND, 'User not found');
    return successResponse(res, 200, user);
  } catch (err) {
    if (err.statusCode) return errorResponse(res, err.statusCode, err.code, err.message);
    next(err);
  }
};

const deactivateUser = async (req, res, next) => {
  try {
    const ok = await userService.deactivateUser(
      req.params.id, req.user.organizationId, req.user.id
    );
    if (!ok) return errorResponse(res, 404, ErrorCodes.NOT_FOUND, 'User not found');
    return successResponse(res, 200, { message: 'User deactivated' });
  } catch (err) {
    if (err.statusCode) return errorResponse(res, err.statusCode, err.code, err.message);
    next(err);
  }
};

module.exports = { listUsers, getUser, updateRole, deactivateUser };