const router = require('express').Router();
const ctrl   = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireMinRole } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { updateUserRoleSchema } = require('../validators/schemas');

router.use(authenticate);

// List users — any authenticated member of the org
router.get('/', ctrl.listUsers);

// Get single user — any authenticated member of the org
router.get('/:id', ctrl.getUser);

// Update role — ADMIN only
router.patch('/:id/role', requireRole('ADMIN'), validate(updateUserRoleSchema), ctrl.updateRole);

// Deactivate — ADMIN only
router.delete('/:id', requireRole('ADMIN'), ctrl.deactivateUser);

module.exports = router;