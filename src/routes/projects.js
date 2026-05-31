const router = require('express').Router();
const ctrl   = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');
const { requireMinRole } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createProjectSchema, updateProjectSchema } = require('../validators/schemas');

router.use(authenticate);

router.get('/',    ctrl.listProjects);
router.get('/:id', ctrl.getProject);

// MANAGER and above can create/edit/delete projects
router.post('/',    requireMinRole('MANAGER'), validate(createProjectSchema), ctrl.createProject);
router.patch('/:id', requireMinRole('MANAGER'), validate(updateProjectSchema), ctrl.updateProject);
router.delete('/:id', requireMinRole('MANAGER'), ctrl.deleteProject);

module.exports = router;