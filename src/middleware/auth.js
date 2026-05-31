const { verifyAccessToken } = require('../utils/jwt');
const { errorResponse, ErrorCodes } = require('../utils/response');

/**
 * Extracts and verifies the Bearer access token.
 * Attaches the decoded payload to req.user:
 *   { id, email, role, organizationId }
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 401, ErrorCodes.UNAUTHORIZED, 'Access token required');
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      id:             decoded.id,
      email:          decoded.email,
      role:           decoded.role,
      organizationId: decoded.organizationId,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 401, ErrorCodes.TOKEN_EXPIRED, 'Access token has expired');
    }
    return errorResponse(res, 401, ErrorCodes.TOKEN_INVALID, 'Invalid access token');
  }
};

module.exports = { authenticate };