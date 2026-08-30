const { Activity, User, Project, Task } = require("../models");

const ENTITY_TYPES = [
  "project",
  "task",
  "subtask",
  "comment",
  "attachment",
  "member",
  "invitation",
];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// Parse a query value that must be a positive integer. Returns null if absent,
// or NaN if present but invalid (so the caller can reject it).
function parsePositiveInt(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return NaN;
  }
  return num;
}

// GET /api/activities
exports.getActivities = async (req, res) => {
  try {
    const { entity_type } = req.query;

    // Authorization scope is ALWAYS the authenticated user's organization.
    const where = {
      organization_id: req.user.organization_id,
    };

    // --- optional filters (all still scoped by organization_id above) ---
    const projectId = parsePositiveInt(req.query.project_id);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project_id." });
    }
    if (projectId !== null) {
      where.project_id = projectId;
    }

    const taskId = parsePositiveInt(req.query.task_id);
    if (Number.isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task_id." });
    }
    if (taskId !== null) {
      where.task_id = taskId;
    }

    const userId = parsePositiveInt(req.query.user_id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user_id." });
    }
    if (userId !== null) {
      where.user_id = userId;
    }

    if (entity_type !== undefined) {
      if (!ENTITY_TYPES.includes(entity_type)) {
        return res.status(400).json({ message: "Invalid entity_type." });
      }
      where.entity_type = entity_type;
    }

    // --- pagination ---
    let limit = parsePositiveInt(req.query.limit);
    if (Number.isNaN(limit)) {
      return res.status(400).json({ message: "Invalid limit." });
    }
    if (limit === null) {
      limit = DEFAULT_LIMIT;
    }
    if (limit > MAX_LIMIT) {
      limit = MAX_LIMIT;
    }

    let page = parsePositiveInt(req.query.page);
    if (Number.isNaN(page)) {
      return res.status(400).json({ message: "Invalid page." });
    }
    if (page === null) {
      page = 1;
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Activity.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name", "email", "avatar_url"],
          required: false,
        },
        {
          model: Project,
          as: "project",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: Task,
          as: "task",
          attributes: ["id", "title"],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      activities: rows,
      pagination: {
        total: count,
        page,
        limit,
        total_pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Get activities error:", error);
    return res.status(500).json({
      message: "Server error while fetching activities.",
    });
  }
};
