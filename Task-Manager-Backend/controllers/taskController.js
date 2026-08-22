const {
  Task,
  Project,
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
