const projectService = require('../services/projectService');
const { successResponse, errorResponse, ErrorCodes } = require('../utils/response');

const listProjects = async (req, res, next) => {
  try {
    const projects = await projectService.listProjects(req.user.organizationId);
    return successResponse(res, 200, projects);
  } catch (err) { next(err); }
};

const getProject = async (req, res, next) => {
  try {
    const project = await projectService.getProjectById(req.params.id, req.user.organizationId);
    if (!project) return errorResponse(res, 404, ErrorCodes.NOT_FOUND, 'Project not found');
    return successResponse(res, 200, project);
  } catch (err) { next(err); }
};

const createProject = async (req, res, next) => {
  try {
    const project = await projectService.createProject({
      organizationId: req.user.organizationId,
      userId:         req.user.id,
      ...req.body,
    });
    return successResponse(res, 201, project);
  } catch (err) { next(err); }
};

const updateProject = async (req, res, next) => {
  try {
    const project = await projectService.updateProject(
      req.params.id, req.user.organizationId, req.body
    );
    if (!project) return errorResponse(res, 404, ErrorCodes.NOT_FOUND, 'Project not found');
    return successResponse(res, 200, project);
  } catch (err) { next(err); }
};

const deleteProject = async (req, res, next) => {
  try {
    const ok = await projectService.deleteProject(req.params.id, req.user.organizationId);
    if (!ok) return errorResponse(res, 404, ErrorCodes.NOT_FOUND, 'Project not found');
    return successResponse(res, 200, { message: 'Project deleted successfully' });
  } catch (err) { next(err); }
};

module.exports = { listProjects, getProject, createProject, updateProject, deleteProject };