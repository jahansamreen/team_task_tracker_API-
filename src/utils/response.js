/**
 * Standardised error codes used throughout the API.
 */
const ErrorCodes = {
  VALIDATION_ERROR:       'VALIDATION_ERROR',
  UNAUTHORIZED:           'UNAUTHORIZED',
  FORBIDDEN:              'FORBIDDEN',
  NOT_FOUND:              'NOT_FOUND',
  CONFLICT:               'CONFLICT',
  INVALID_TRANSITION:     'INVALID_TRANSITION',
  INVALID_CREDENTIALS:    'INVALID_CREDENTIALS',
  TOKEN_EXPIRED:          'TOKEN_EXPIRED',
  TOKEN_INVALID:          'TOKEN_INVALID',
  INTERNAL_ERROR:         'INTERNAL_ERROR',
};

/**
 * Build a consistent error response body.
 * Shape:  { status, code, message, [errors] }
 */
const errorResponse = (res, statusCode, code, message, errors = undefined) => {
  const body = { status: statusCode, code, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

/**
 * Build a consistent success response body.
 * Shape:  { status, data, [meta] }
 */
const successResponse = (res, statusCode, data, meta = undefined) => {
  const body = { status: statusCode, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

module.exports = { ErrorCodes, errorResponse, successResponse };