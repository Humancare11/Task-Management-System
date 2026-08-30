import api from "./client.js";

// GET /api/activities — global organization activity feed.
// Auth (JWT) is attached automatically by the shared Axios client.
export function listActivities(params = {}) {
  return api.get("/activities", { params });
}

// GET /api/activities?project_id=<projectId> — activity scoped to one project.
export function listProjectActivities(projectId, params = {}) {
  return listActivities({
    ...params,
    project_id: projectId,
  });
}

// GET /api/activities?task_id=<taskId> — activity scoped to one task.
export function listTaskActivities(taskId, params = {}) {
  return listActivities({
    ...params,
    task_id: taskId,
  });
}
