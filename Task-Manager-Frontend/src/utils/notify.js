const { Notification } = require("../models");
const { getIO } = require("../socket");

async function createNotification({
  organizationId,
  userId,
  actorId,
  type,
  taskId,
  projectId,
  message,
}) {
  // Don't notify someone about their own action
  if (userId === actorId) return null;

  const notification = await Notification.create({
    organization_id: organizationId,
    user_id: userId,
    actor_id: actorId || null,
    type,
    task_id: taskId || null,
    project_id: projectId || null,
    message,
  });

  try {
    getIO().to(`user:${userId}`).emit("notification:new", notification);
  } catch (err) {
    console.error("Socket emit failed:", err.message);
  }

  return notification;
}

module.exports = { createNotification };