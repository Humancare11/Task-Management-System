const { Project, ProjectMember, User, Task } = require("../models");

// POST /api/projects
exports.createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      status,
      priority,
      start_date,
      due_date,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Project name is required.",
      });
    }

    const project = await Project.create({
      organization_id: req.user.organization_id,
      created_by: req.user.id,
      name: name.trim(),
      description: description || null,
      status: status || "planned",
      priority: priority || "medium",
      start_date: start_date || null,
      due_date: due_date || null,
    });

    return res.status(201).json({
      message: "Project created successfully.",
      project,
    });
  } catch (error) {
    console.error("Create project error:", error);

    return res.status(500).json({
      message: "Server error while creating project.",
    });
  }
};

// GET /api/projects
exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.findAll({
      where: {
        organization_id: req.user.organization_id,
      },
      order: [["created_at", "DESC"]],
    });

    return res.json({
      projects,
    });
  } catch (error) {
    console.error("Get projects error:", error);

    return res.status(500).json({
      message: "Server error while fetching projects.",
    });
  }
};

// GET /api/projects/:id
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findOne({
      where: {
        id: req.params.id,
        organization_id: req.user.organization_id,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    return res.json({
      project,
    });
  } catch (error) {
    console.error("Get project error:", error);

    return res.status(500).json({
      message: "Server error while fetching project.",
    });
  }
};

// GET /api/projects/:id/members
exports.getProjectMembers = async (req, res) => {
  try {
    console.log("Project members params:", req.params);
    console.log("User:", req.user);
    const project = await Project.findOne({
      where: {
        id: req.params.id,
        organization_id: req.user.organization_id,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    const members = await ProjectMember.findAll({
      where: {
        project_id: req.params.id,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "avatar_url",
          ],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    return res.json({
      members,
    });
  } catch (error) {
    console.error("Get project members error:", error);

    return res.status(500).json({
      message: "Server error while fetching project members.",
    });
  }
};

// PUT /api/projects/:id
exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findOne({
      where: {
        id: req.params.id,
        organization_id: req.user.organization_id,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    const {
      name,
      description,
      status,
      priority,
      start_date,
      due_date,
    } = req.body;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          message: "Project name cannot be empty.",
        });
      }

      project.name = name.trim();
    }

    if (description !== undefined) {
      project.description = description;
    }

    if (status !== undefined) {
      project.status = status;
    }

    if (priority !== undefined) {
      project.priority = priority;
    }

    if (start_date !== undefined) {
      project.start_date = start_date;
    }

    if (due_date !== undefined) {
      project.due_date = due_date;
    }

    await project.save();

    return res.json({
      message: "Project updated successfully.",
      project,
    });
  } catch (error) {
    console.error("Update project error:", error);

    return res.status(500).json({
      message: "Server error while updating project.",
    });
  }
};

// DELETE /api/projects/:id
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findOne({
      where: {
        id: req.params.id,
        organization_id: req.user.organization_id,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    await project.destroy();

    return res.json({
      message: "Project deleted successfully.",
    });
  } catch (error) {
    console.error("Delete project error:", error);

    return res.status(500).json({
      message: "Server error while deleting project.",
    });
  }
};

// PUT /api/projects/:id/members/:userId
exports.updateProjectMember = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;

    const allowedRoles = ["manager", "member", "viewer"];

    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Valid role is required: manager, member, or viewer.",
      });
    }

    // Make sure the project belongs to the current organization
    const project = await Project.findOne({
      where: {
        id,
        organization_id: req.user.organization_id,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    // Find the project membership
    const projectMember = await ProjectMember.findOne({
      where: {
        project_id: id,
        user_id: userId,
      },
    });

    if (!projectMember) {
      return res.status(404).json({
        message: "Project member not found.",
      });
    }

    projectMember.role = role;

    await projectMember.save();

    return res.json({
      message: "Project member role updated successfully.",
      member: projectMember,
    });
  } catch (error) {
    console.error("Update project member error:", error);

    return res.status(500).json({
      message: "Server error while updating project member.",
    });
  }
};

// DELETE /api/projects/:id/members/:userId
exports.removeProjectMember = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const project = await Project.findOne({
      where: {
        id,
        organization_id: req.user.organization_id,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    const projectMember = await ProjectMember.findOne({
      where: {
        project_id: id,
        user_id: userId,
      },
    });

    if (!projectMember) {
      return res.status(404).json({
        message: "Project member not found.",
      });
    }

    await projectMember.destroy();

    return res.json({
      message: "Project member removed successfully.",
    });
  } catch (error) {
    console.error("Remove project member error:", error);

    return res.status(500).json({
      message: "Server error while removing project member.",
    });
  }
};

// POST /api/projects/:projectId/tasks
exports.createTask = async (req, res) => {
  try {
    const { projectId } = req.params;

    const {
      title,
      description,
      status,
      priority,
      assigned_to,
      due_date,
    } = req.body;

    // 1. Validate title
    if (!title || !title.trim()) {
      return res.status(400).json({
        message: "Task title is required.",
      });
    }

    // 2. Verify project belongs to current organization
    const project = await Project.findOne({
      where: {
        id: projectId,
        organization_id: req.user.organization_id,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    // 3. If assigning a user, verify they are a project member
    if (assigned_to) {
      const projectMember = await ProjectMember.findOne({
        where: {
          project_id: projectId,
          user_id: assigned_to,
        },
      });

      if (!projectMember) {
        return res.status(400).json({
          message: "Assigned user is not a member of this project.",
        });
      }
    }

    // 4. Create task
    const task = await Task.create({
      organization_id: req.user.organization_id,
      project_id: projectId,
      title: title.trim(),
      description: description || null,
      status: status || "todo",
      priority: priority || "medium",
      assigned_to: assigned_to || null,
      created_by: req.user.id,
      due_date: due_date || null,
    });

    return res.status(201).json({
      message: "Task created successfully.",
      task,
    });
  } catch (error) {
    console.error("Create task error:", error);

    return res.status(500).json({
      message: "Server error while creating task.",
    });
  }
};

// GET /api/projects/:projectId/tasks
exports.getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;

    // 1. Verify project belongs to current organization
    const project = await Project.findOne({
      where: {
        id: projectId,
        organization_id: req.user.organization_id,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    // 2. Get all tasks for this project
    const tasks = await Task.findAll({
      where: {
        project_id: projectId,
        organization_id: req.user.organization_id,
      },
      include: [
        {
          model: require("../models").User,
          as: "assignee",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "avatar_url",
          ],
        },
        {
          model: require("../models").User,
          as: "creator",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.json({
      tasks,
    });
  } catch (error) {
    console.error("Get project tasks error:", error);

    return res.status(500).json({
      message: "Server error while fetching project tasks.",
    });
  }
};

// GET /api/projects/:projectId/tasks/:taskId
exports.getTaskById = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    // 1. Verify project belongs to current organization
    const project = await Project.findOne({
      where: {
        id: projectId,
        organization_id: req.user.organization_id,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    // 2. Find task inside this project and organization
    const task = await Task.findOne({
      where: {
        id: taskId,
        project_id: projectId,
        organization_id: req.user.organization_id,
      },
      include: [
        {
          model: require("../models").User,
          as: "assignee",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "avatar_url",
          ],
        },
        {
          model: require("../models").User,
          as: "creator",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
          ],
        },
      ],
    });

    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    return res.json({
      task,
    });
  } catch (error) {
    console.error("Get task error:", error);

    return res.status(500).json({
      message: "Server error while fetching task.",
    });
  }
};

// PUT /api/projects/:projectId/tasks/:taskId
exports.updateTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    const {
      title,
      description,
      status,
      priority,
      assigned_to,
      due_date,
    } = req.body;

    // 1. Verify project belongs to current organization
    const project = await Project.findOne({
      where: {
        id: projectId,
        organization_id: req.user.organization_id,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    // 2. Find task inside project and organization
    const task = await Task.findOne({
      where: {
        id: taskId,
        project_id: projectId,
        organization_id: req.user.organization_id,
      },
    });

    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    // 3. Validate title if provided
    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({
          message: "Task title cannot be empty.",
        });
      }

      task.title = title.trim();
    }

    // 4. Update fields
    if (description !== undefined) {
      task.description = description;
    }

    if (status !== undefined) {
      task.status = status;
    }

    if (priority !== undefined) {
      task.priority = priority;
    }

    if (due_date !== undefined) {
      task.due_date = due_date;
    }

    // 5. Validate new assignee
    if (assigned_to !== undefined) {
      if (assigned_to === null) {
        task.assigned_to = null;
      } else {
        const projectMember = await ProjectMember.findOne({
          where: {
            project_id: projectId,
            user_id: assigned_to,
          },
        });

        if (!projectMember) {
          return res.status(400).json({
            message: "Assigned user is not a member of this project.",
          });
        }

        task.assigned_to = assigned_to;
      }
    }

    await task.save();

    return res.json({
      message: "Task updated successfully.",
      task,
    });
  } catch (error) {
    console.error("Update task error:", error);

    return res.status(500).json({
      message: "Server error while updating task.",
    });
  }
};

// DELETE /api/projects/:projectId/tasks/:taskId
exports.deleteTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    // 1. Verify project belongs to current organization
    const project = await Project.findOne({
      where: {
        id: projectId,
        organization_id: req.user.organization_id,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    // 2. Find task inside project and organization
    const task = await Task.findOne({
      where: {
        id: taskId,
        project_id: projectId,
        organization_id: req.user.organization_id,
      },
    });

    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    // 3. Delete task
    await task.destroy();

    return res.json({
      message: "Task deleted successfully.",
    });
  } catch (error) {
    console.error("Delete task error:", error);

    return res.status(500).json({
      message: "Server error while deleting task.",
    });
  }
};