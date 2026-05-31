const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  registerSchema, loginSchema, refreshSchema
} = require('../validators/schemas');

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user (and optionally create an organization)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, full_name]
 *             properties:
 *               email:             { type: string, format: email }
 *               password:          { type: string, minLength: 8 }
 *               full_name:         { type: string }
 *               organization_name: { type: string, description: "Required if not joining existing org" }
 *               organization_id:   { type: string, format: uuid, description: "Join an existing org" }
 *               invite_role:       { type: string, enum: [MANAGER, MEMBER] }
 */
router.post('/register', validate(registerSchema), ctrl.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and receive JWT token pair
 */
router.post('/login',    validate(loginSchema),    ctrl.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh token and get a new access token
 */
router.post('/refresh',  validate(refreshSchema),  ctrl.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke refresh token (logout)
 */
router.post('/logout',   validate(refreshSchema),  ctrl.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user info from token
 *     security: [{ bearerAuth: [] }]
 */
router.get('/me', authenticate, ctrl.me);

module.exports = router;