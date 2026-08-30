const { Activity, User, Project, Task } = require("../models");
const { getIO } = require("../socket");

/**
 * Centralized, safe way to create an application activity / audit-feed record.
 *
 * This is for BUSINESS activity only (project/task/comment/member/... events).
 * It is completely separate from `monitoring_activities` (desktop monitoring).
 *
 * Required: organization_id, user_id, entity_type, action, description.
 * Optional (may be null): project_id, task_id, entity_id, metadata.
 *
 * The caller is responsible for passing the authenticated user's
 * organization_id (never trust it from the request body).
 *
 * After the row is persisted, a real-time `activity:new` event is emitted to
 * the `organization:<organization_id>` Socket.IO room so open Activity feeds
 * update live. Socket failures never affect the primary request.
 */
exports.createActivity = async ({
  organization_id,
  project_id = null,
  task_id = null,
  user_id,
  entity_type,
  entity_id = null,
  action,
  description,
  metadata = null,
}) => {
  try {
    if (!organization_id) throw new Error("createActivity: organization_id is required");
    if (!user_id) throw new Error("createActivity: user_id is required");
    if (!entity_type) throw new Error("createActivity: entity_type is required");
    if (!action) throw new Error("createActivity: action is required");
    if (!description) throw new Error("createActivity: description is required");

    const activity = await Activity.create({
      organization_id,
      project_id,
      task_id,
      user_id,
      entity_type,
      entity_id,
      action,
      description,
      metadata,
    });

    // Real-time delivery — same payload shape as GET /api/activities rows
    // (persisted row + user / project / task associations). Best-effort only.
    try {
      const full = await Activity.findByPk(activity.id, {
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
      });

      getIO()
        .to(`organization:${organization_id}`)
        .emit("activity:new", full ?? activity);
    } catch (socketError) {
      console.error("Failed to emit activity socket event:", socketError);
    }

    return activity;
  } catch (error) {
    // Never let audit logging break the primary request flow.
    console.error("Create activity error:", error);
    return null;
  }
};
