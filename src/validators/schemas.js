const Joi = require('joi');
const { ALL_STATUSES, ALL_PRIORITIES } = require('../utils/transitions');

// -------------------------------------------------------
// Auth schemas
// -------------------------------------------------------
const registerSchema = Joi.object({
  email:            Joi.string().email().lowercase().required(),
  password:         Joi.string()
                      .min(8)
                      .pattern(/^(?=.*[A-Z])(?=.*[0-9])/)
                      .required()
                      .messages({
                        'string.pattern.base': 'password must contain at least one uppercase letter and one number',
                      }),
  full_name:        Joi.string().min(2).max(255).required(),
  organization_name: Joi.string().min(2).max(255).when('organization_id', {
                       is: Joi.exist(),
                       then: Joi.forbidden(),
                       otherwise: Joi.required(),
                     }).messages({
                       'any.required': 'organization_name is required when not joining an existing org',
                     }),
  organization_id:  Joi.string().uuid(),
  invite_role:      Joi.string().valid('MANAGER', 'MEMBER').default('MEMBER'),
});

const loginSchema = Joi.object({
  email:    Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refresh_token: Joi.string().required(),
});

// -------------------------------------------------------
// User schemas
// -------------------------------------------------------
const updateUserRoleSchema = Joi.object({
  role: Joi.string().valid('ADMIN', 'MANAGER', 'MEMBER').required(),
});

// -------------------------------------------------------
// Project schemas
// -------------------------------------------------------
const createProjectSchema = Joi.object({
  name:        Joi.string().min(1).max(255).required(),
  description: Joi.string().max(2000).allow('', null),
});

const updateProjectSchema = Joi.object({
  name:        Joi.string().min(1).max(255),
  description: Joi.string().max(2000).allow('', null),
}).min(1);

// -------------------------------------------------------
// Task schemas
// -------------------------------------------------------
const createTaskSchema = Joi.object({
  title:       Joi.string().min(1).max(500).required(),
  description: Joi.string().max(5000).allow('', null),
  priority:    Joi.string().valid(...ALL_PRIORITIES).default('MEDIUM'),
  assignee_id: Joi.string().uuid().allow(null),
  project_id:  Joi.string().uuid().allow(null),
  due_date:    Joi.date().iso().min('now').allow(null).messages({
                 'date.min': 'due_date must be a future date',
               }),
});

const updateTaskSchema = Joi.object({
  title:       Joi.string().min(1).max(500),
  description: Joi.string().max(5000).allow('', null),
  priority:    Joi.string().valid(...ALL_PRIORITIES),
  assignee_id: Joi.string().uuid().allow(null),
  project_id:  Joi.string().uuid().allow(null),
  due_date:    Joi.date().iso().allow(null).messages({
                 'date.min': 'due_date must be a future date',
               }),
}).min(1);

const transitionTaskSchema = Joi.object({
  status: Joi.string().valid(...ALL_STATUSES).required(),
  note:   Joi.string().max(500).allow('', null),
});

const listTasksQuerySchema = Joi.object({
  page:        Joi.number().integer().min(1).default(1),
  limit:       Joi.number().integer().min(1).max(100).default(20),
  status:      Joi.string().valid(...ALL_STATUSES),
  priority:    Joi.string().valid(...ALL_PRIORITIES),
  assignee_id: Joi.string().uuid(),
  project_id:  Joi.string().uuid(),
  search:      Joi.string().max(200),
  sort_by:     Joi.string().valid('created_at', 'due_date', 'priority', 'updated_at').default('created_at'),
  sort_dir:    Joi.string().valid('asc', 'desc').default('desc'),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateUserRoleSchema,
  createProjectSchema,
  updateProjectSchema,
  createTaskSchema,
  updateTaskSchema,
  transitionTaskSchema,
  listTasksQuerySchema,
};