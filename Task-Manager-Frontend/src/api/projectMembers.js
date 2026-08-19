import api from "./client.js";

export const listProjectMembers = (projectId) =>
  api.get(`/projects/${projectId}/members`);
export const addProjectMember = (projectId, data) =>
  api.post(`/projects/${projectId}/members`, data);
export const updateProjectMemberRole = (projectId, userId, role) =>
  api.put(`/projects/${projectId}/members/${userId}`, { role });
export const removeProjectMember = (projectId, userId) =>
  api.delete(`/projects/${projectId}/members/${userId}`);
