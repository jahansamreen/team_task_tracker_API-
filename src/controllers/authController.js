const authService = require('../services/authService');
const { successResponse, errorResponse, ErrorCodes } = require('../utils/response');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    return successResponse(res, 201, result);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.statusCode, err.code || ErrorCodes.VALIDATION_ERROR, err.message);
    }
    if (err.code === '23505') {
      return errorResponse(res, 409, ErrorCodes.CONFLICT, 'An account with this email already exists in this organization');
    }
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    return successResponse(res, 200, result);
  } catch (err) {
    if (err.statusCode === 401) {
      return errorResponse(res, 401, ErrorCodes.INVALID_CREDENTIALS, err.message);
    }
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const tokens = await authService.refreshTokens(req.body.refresh_token);
    return successResponse(res, 200, tokens);
  } catch (err) {
    if (err.statusCode === 401) {
      return errorResponse(res, 401, err.code || ErrorCodes.TOKEN_INVALID, err.message);
    }
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.revokeToken(req.body.refresh_token);
    return successResponse(res, 200, { message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res) => {
  return successResponse(res, 200, req.user);
};

module.exports = { register, login, refresh, logout, me };