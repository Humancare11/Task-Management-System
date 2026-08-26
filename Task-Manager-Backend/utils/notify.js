const { Notification } = require("../models");
const { getIO } = require("../socket");

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
    const notification = await Notification.create({
      organization_id: organizationId,
      user_id: userId,
      actor_id: actorId,
      type,
      task_id: taskId,
      project_id: projectId,
      message,
    });

    try {
      getIO().to(`user:${userId}`).emit("notification:new", notification);
    } catch (socketError) {
      console.error("Failed to emit notification socket event:", socketError);
    }

    return notification;
  } catch (error) {
    console.error("Create notification error:", error);
  }
};
