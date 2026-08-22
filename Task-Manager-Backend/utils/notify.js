const { Notification } = require("../models");

exports.createNotification = async ({
  organizationId,
  userId,
  actorId,
  type,
  taskId,
  projectId,
  message,
}) => {
  try {
    return await Notification.create({
      organization_id: organizationId,
      user_id: userId,
      actor_id: actorId,
      type,
      task_id: taskId,
      project_id: projectId,
      message,
    });
  } catch (error) {
    console.error("Create notification error:", error);
  }
};
