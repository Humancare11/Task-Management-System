const {
  Task,
  Subtask,
  Project,
  User,
} = require("../models");

exports.getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: {
        organization_id: req.user.organization_id,
        assigned_to: req.user.id,
      },
      include: [
        {
          model: Project,
          as: "project",
          attributes: [
            "id",
            "name",
            "status",
            "priority",
          ],
        },
        {
          model: User,
          as: "assignee",
          attributes: ["id", "first_name", "last_name", "email", "avatar_url"],
        },
      ],
      order: [
        ["due_date", "ASC"],
        ["created_at", "DESC"],
      ],
    });

    return res.json({
      tasks,
    });
  } catch (error) {
    console.error("Get my tasks error:", error);

    return res.status(500).json({
      message: "Server error while fetching your tasks.",
    });
  }
};

exports.getMySubtasks = async (req, res) => {
  try {
    const subtasks = await Subtask.findAll({
      where: {
        organization_id: req.user.organization_id,
        assigned_to: req.user.id,
      },
      include: [
        {
          model: Task,
          as: "task",
          attributes: ["id", "title", "project_id"],
          include: [
            {
              model: Project,
              as: "project",
              attributes: ["id", "name"],
            },
          ],
        },
      ],
      order: [
        ["due_date", "ASC"],
        ["created_at", "DESC"],
      ],
    });

    return res.json({
      subtasks,
    });
  } catch (error) {
    console.error("Get my subtasks error:", error);

    return res.status(500).json({
      message: "Server error while fetching your subtasks.",
    });
  }
};
