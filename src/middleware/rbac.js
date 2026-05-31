const { errorResponse, ErrorCodes } = require('../utils/response');

/**
 * Role hierarchy (higher index = more permissions).
 * Used to implement "at least this role" checks.
 */
const ROLE_HIERARCHY = ['MEMBER', 'MANAGER', 'ADMIN'];

const roleIndex = (role) => ROLE_HIERARCHY.indexOf(role);

/**
 * Middleware factory: only allow requests from users whose role
 * appears in the `allowedRoles` list.
 *
 * RBAC is enforced HERE — controllers never check roles themselves.
 *
 * @param {...string} allowedRoles - e.g. requireRole('ADMIN', 'MANAGER')
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, 401, ErrorCodes.UNAUTHORIZED, 'Authentication required');
  }
  if (!allowedRoles.includes(req.user.role)) {
    return errorResponse(
      res,
      403,
      ErrorCodes.FORBIDDEN,
      `Requires one of the following roles: ${allowedRoles.join(', ')}`
    );
  }
  next();
};

/**
 * Middleware factory: allow users with AT LEAST `minimumRole` privilege.
 *
 * @param {string} minimumRole - Minimum role required (inclusive)
 */
const requireMinRole = (minimumRole) => (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, 401, ErrorCodes.UNAUTHORIZED, 'Authentication required');
  }
  if (roleIndex(req.user.role) < roleIndex(minimumRole)) {
    return errorResponse(
      res,
      403,
      ErrorCodes.FORBIDDEN,
      `Requires role ${minimumRole} or higher`
    );
  }
  next();
};

/**
 * Middleware: allow if user is the resource owner OR has elevated role.
 * Useful for "assignee OR manager/admin" patterns.
 * Sets req.isOwner = boolean for further conditional logic in controllers.
 *
 * @param {Function} getResourceUserId - async (req) => userId string
 */
const requireOwnerOrRole = (getResourceUserId, ...allowedRoles) =>
  async (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 401, ErrorCodes.UNAUTHORIZED, 'Authentication required');
    }
    try {
      const resourceUserId = await getResourceUserId(req);
      const isOwner = resourceUserId === req.user.id;
      const hasRole = allowedRoles.includes(req.user.role);

      if (!isOwner && !hasRole) {
        return errorResponse(
          res,
          403,
          ErrorCodes.FORBIDDEN,
          'You do not have permission to perform this action'
        );
      }
      req.isOwner = isOwner;
      next();
    } catch (err) {
      next(err);
    }
  };

module.exports = { requireRole, requireMinRole, requireOwnerOrRole, ROLE_HIERARCHY };