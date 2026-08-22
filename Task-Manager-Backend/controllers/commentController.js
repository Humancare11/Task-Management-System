const { Comment, Task, Project, User } = require("../models");
const { createNotification } = require("../utils/notify");
const { getIO } = require("../socket");

exports.getComments = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    const project = await Project.findOne({
      where: { id: projectId, organization_id: req.user.organization_id },
    });
    if (!project) return res.status(404).json({ message: "Project not found." });

    const task = await Task.findOne({
      where: { id: taskId, project_id: projectId, organization_id: req.user.organization_id },
    });
    if (!task) return res.status(404).json({ message: "Task not found." });

    const comments = await Comment.findAll({
      where: { task_id: taskId, organization_id: req.user.organization_id },
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "first_name", "last_name", "email", "avatar_url"],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    return res.json({ comments });
  } catch (error) {
    console.error("Get comments error:", error);
    return res.status(500).json({ message: "Server error while fetching comments." });
  }
};

exports.createComment = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Comment content is required." });
    }

    const project = await Project.findOne({
      where: { id: projectId, organization_id: req.user.organization_id },
    });
    if (!project) return res.status(404).json({ message: "Project not found." });

    const task = await Task.findOne({
      where: { id: taskId, project_id: projectId, organization_id: req.user.organization_id },
    });
    if (!task) return res.status(404).json({ message: "Task not found." });

    const comment = await Comment.create({
      task_id: taskId,
      organization_id: req.user.organization_id,
      user_id: req.user.id,
      content: content.trim(),
    });

    // Reload with author so frontend gets full object back
    const full = await Comment.findOne({
      where: { id: comment.id },
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "first_name", "last_name", "email", "avatar_url"],
        },
      ],
    });

    if (task.assigned_to && task.assigned_to !== req.user.id) {
      const actor = await User.findByPk(req.user.id, { attributes: ["first_name"] });
      console.log("actor lookup:", req.user.id, actor);
      await createNotification({
        organizationId: req.user.organization_id,
        userId: task.assigned_to,
        actorId: req.user.id,
        type: "comment_added",
        taskId: task.id,
        projectId: projectId,
        message: `${actor?.first_name || "Someone"} commented on "${task.title}"`,
      });
    }

    try {
      getIO().to(`task:${taskId}`).emit("comment:created", full);
    } catch (err) {
      console.error("Socket emit failed:", err.message);
    }

    return res.status(201).json({ message: "Comment created.", comment: full });
  } catch (error) {
    console.error("Create comment error:", error);
    return res.status(500).json({ message: "Server error while creating comment." });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { projectId, taskId, commentId } = req.params;

    const project = await Project.findOne({
      where: { id: projectId, organization_id: req.user.organization_id },
    });
    if (!project) return res.status(404).json({ message: "Project not found." });

    const task = await Task.findOne({
      where: { id: taskId, project_id: projectId, organization_id: req.user.organization_id },
    });
    if (!task) return res.status(404).json({ message: "Task not found." });

    const comment = await Comment.findOne({
      where: { id: commentId, task_id: taskId, organization_id: req.user.organization_id },
    });
    if (!comment) return res.status(404).json({ message: "Comment not found." });

    // Only the author or management can delete
    const canDelete =
      comment.user_id === req.user.id ||
      ["owner", "admin", "manager"].includes(req.user.role);

    if (!canDelete) {
      return res.status(403).json({ message: "You cannot delete this comment." });
    }

    const deletedCommentId = comment.id;
    await comment.destroy();

    try {
      getIO().to(`task:${taskId}`).emit("comment:deleted", { commentId: deletedCommentId });
    } catch (err) {
      console.error("Socket emit failed:", err.message);
    }

    return res.json({ message: "Comment deleted." });
  } catch (error) {
    console.error("Delete comment error:", error);
    return res.status(500).json({ message: "Server error while deleting comment." });
  }
};