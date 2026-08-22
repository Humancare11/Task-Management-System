import api from "./client.js";

export function listSubtasks(projectId, taskId) {
  return api.get(
    `/projects/${projectId}/tasks/${taskId}/subtasks`
  );
}

export function createSubtask(projectId, taskId, data) {
  return api.post(
    `/projects/${projectId}/tasks/${taskId}/subtasks`,
    data
  );
}

export function updateSubtask(projectId, taskId, subtaskId, data) {
  return api.put(
    `/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`,
    data
  );
}

export function deleteSubtask(projectId, taskId, subtaskId) {
  return api.delete(
    `/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`
  );
}
