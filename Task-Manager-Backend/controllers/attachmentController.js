const path = require("path");
const fs = require("fs");
const { Attachment, Task, Subtask, Comment, Project, User } = require("../models");

async function resolveContext(req) {
  const { projectId, taskId, subtaskId, commentId } = req.params;

  const project = await Project.findOne({
    where: {
      id: projectId,
      organization_id: req.user.organization_id,
    },
  });

  if (!project) {
    return {
      error: {
        status: 404,
        message: "Project not found.",
      },
    };
  }

  const task = await Task.findOne({
    where: {
      id: taskId,
      project_id: projectId,
      organization_id: req.user.organization_id,
    },
  });

  if (!task) {
    return {
      error: {
        status: 404,
        message: "Task not found.",
      },
    };
  }

  let subtask = null;

  if (subtaskId) {
    subtask = await Subtask.findOne({
      where: {
        id: subtaskId,
        task_id: taskId,
        organization_id: req.user.organization_id,
      },
    });

    if (!subtask) {
      return {
        error: {
          status: 404,
          message: "Subtask not found.",
        },
      };
    }
  }

  let comment = null;

  if (commentId) {
    comment = await Comment.findOne({
      where: {
        id: commentId,
        task_id: taskId,
        organization_id: req.user.organization_id,
      },
    });

    if (!comment) {
      return {
        error: {
          status: 404,
          message: "Comment not found.",
        },
      };
    }
  }

  return {
    project,
    task,
    subtask,
    comment,
  };
}

exports.uploadAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const { taskId } = req.params;
    const { error, subtask, comment } = await resolveContext(req);
    if (error) return res.status(error.status).json({ message: error.message });

    const attachment = await Attachment.create({
  task_id: taskId,
  subtask_id: subtask ? subtask.id : null,
  comment_id: comment ? comment.id : null,
  organization_id: req.user.organization_id,
  uploaded_by: req.user.id,
  file_name: req.file.originalname,
  file_path: req.file.filename,
  file_size: req.file.size,
  mime_type: req.file.mimetype,
});

    return res.status(201).json({
      message: "File uploaded successfully.",
      attachment: {
        id: attachment.id,
        file_name: attachment.file_name,
        file_size: attachment.file_size,
        mime_type: attachment.mime_type,
        url: `/uploads/${attachment.file_path}`,
        created_at: attachment.created_at,
      },
    });
  } catch (error) {
    console.error("Upload attachment error:", error);
    return res.status(500).json({ message: "Server error while uploading file." });
  }
};

exports.getAttachments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { error, subtask, comment } = await resolveContext(req);
    if (error) return res.status(error.status).json({ message: error.message });

    const attachments = await Attachment.findAll({
      where: comment
        ? { comment_id: comment.id, organization_id: req.user.organization_id }
        : subtask
          ? { subtask_id: subtask.id, organization_id: req.user.organization_id }
          : { task_id: taskId, subtask_id: null, comment_id: null, organization_id: req.user.organization_id },
      include: [
        {
          model: User,
          as: "uploader",
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    return res.json({
      attachments: attachments.map((a) => ({
        id: a.id,
        file_name: a.file_name,
        file_size: a.file_size,
        mime_type: a.mime_type,
        url: `/uploads/${a.file_path}`,
        uploaded_by: a.uploader,
        created_at: a.created_at,
      })),
    });
  } catch (error) {
    console.error("Get attachments error:", error);
    return res.status(500).json({ message: "Server error while fetching attachments." });
  }
};

exports.deleteAttachment = async (req, res) => {
  try {
    const { taskId, attachmentId } = req.params;
    const { error, subtask, comment } = await resolveContext(req);
    if (error) return res.status(error.status).json({ message: error.message });

    const attachment = await Attachment.findOne({
      where: comment
        ? { id: attachmentId, comment_id: comment.id, organization_id: req.user.organization_id }
        : subtask
          ? { id: attachmentId, subtask_id: subtask.id, organization_id: req.user.organization_id }
          : { id: attachmentId, task_id: taskId, subtask_id: null, comment_id: null, organization_id: req.user.organization_id },
    });
    if (!attachment) return res.status(404).json({ message: "Attachment not found." });

    // Only uploader or management can delete
    const canDelete =
      attachment.uploaded_by === req.user.id ||
      ["owner", "admin", "manager"].includes(req.user.role);

    if (!canDelete) {
      return res.status(403).json({ message: "You cannot delete this attachment." });
    }

    // Delete file from disk
    const filePath = path.join(__dirname, "../uploads", attachment.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await attachment.destroy();

    return res.json({ message: "Attachment deleted." });
  } catch (error) {
    console.error("Delete attachment error:", error);
    return res.status(500).json({ message: "Server error while deleting attachment." });
  }
};