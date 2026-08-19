const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const {
  createProject,
  getProjects,
  getProjectById,
  getProjectMembers,
  updateProjectMember,
  removeProjectMember,
  createTask,
  getProjectTasks,
  getTaskById,
  updateTask,
  deleteTask,
  updateProject,
  deleteProject,
} = require("../controllers/projectController");
const { addProjectMember } = require("../controllers/projectMemberController");

// All project routes require authentication
router.use(requireAuth);

// Create project
router.post(
  "/",
  requireRole("owner", "admin", "manager"),
  createProject
);
// Get all projects for current organization
router.get(
  "/",
  requireRole("owner", "admin", "manager", "member", "client"),
  getProjects
);

// Get members assigned to a project
router.get(
  "/:id/members",
  requireRole("owner", "admin", "manager", "member", "client"),
  getProjectMembers
);

// Update project member role
router.put(
  "/:id/members/:userId",
  requireRole("owner", "admin", "manager"),
  updateProjectMember
);

// delete project member role
router.delete(
  "/:id/members/:userId",
  requireRole("owner", "admin", "manager"),
  removeProjectMember
);

// Create task under a project
router.post(
  "/:projectId/tasks",
  requireRole("owner", "admin", "manager", "member"),
  createTask
);

// Get all tasks under a project
router.get("/:projectId/tasks", getProjectTasks);

// Get single task under a project
router.get(
  "/:projectId/tasks/:taskId",
  requireRole("owner", "admin", "manager", "member", "client"),
  getTaskById
);

// Update task under a project
router.put(
  "/:projectId/tasks/:taskId",
  requireRole("owner", "admin", "manager"),
  updateTask
);

// Delete task under a project
router.delete(
  "/:projectId/tasks/:taskId",
  requireRole("owner", "admin", "manager"),
  deleteTask
);

// Get single project
router.get(
  "/:id",
  requireRole("owner", "admin", "manager", "member", "client"),
  getProjectById
);

// Update project
router.put(
  "/:id",
  requireRole("owner", "admin", "manager"),
  updateProject
);

// Delete project
router.delete(
  "/:id",
  requireRole("owner", "admin"),
  deleteProject
);

router.post(
  "/:projectId/members",
  requireRole("owner", "admin", "manager"),
  addProjectMember
);

module.exports = router;