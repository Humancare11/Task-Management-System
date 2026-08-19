import api from "./client.js";

export const listTasks = (projectId) => api.get(`/projects/${projectId}/tasks`);
export const getTask = (projectId, taskId) =>
  api.get(`/projects/${projectId}/tasks/${taskId}`);
export const createTask = (projectId, data) =>
  api.post(`/projects/${projectId}/tasks`, data);
export const updateTask = (projectId, taskId, data) =>
  api.put(`/projects/${projectId}/tasks/${taskId}`, data);
export const deleteTask = (projectId, taskId) =>
  api.delete(`/projects/${projectId}/tasks/${taskId}`);
