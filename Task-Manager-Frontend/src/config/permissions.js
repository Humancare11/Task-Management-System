// Org-role based checks -- UI-visibility gates only. The backend (requireRole
// middleware) is the real enforcement layer; these must stay in sync with it
// but are never a substitute for it.
export const ORG_ELEVATED = ["owner", "admin", "manager"];
export const ORG_DELETE_PROJECT = ["owner", "admin"]; // manager cannot delete a project
export const ORG_MANAGE_TASKS = ["owner", "admin", "manager"];
export const ORG_CREATE_TASK = ["owner", "admin", "manager", "member"];
export const ORG_MANAGE_INVITATIONS = ["owner", "admin"];
export const ORG_MANAGE_SUBTASKS = ["owner", "admin", "manager"];

// Project-member roles (manager|member|viewer, from GET /projects/:id/members)
// are a separate, project-scoped vocabulary from org roles above -- never pass
// a project-member role into these helpers.

export const canCreateProject = (user) => ORG_ELEVATED.includes(user?.role);
export const canEditProject = (user) => ORG_ELEVATED.includes(user?.role);
export const canDeleteProject = (user) => ORG_DELETE_PROJECT.includes(user?.role);
export const canManageProjectMembers = (user) => ORG_ELEVATED.includes(user?.role);
export const canCreateTask = (user) => ORG_CREATE_TASK.includes(user?.role);
export const canEditTask = (user) => ORG_MANAGE_TASKS.includes(user?.role);
export const canDeleteTask = (user) => ORG_MANAGE_TASKS.includes(user?.role);
export const canManageInvitations = (user) => ORG_MANAGE_INVITATIONS.includes(user?.role);

export const canCreateSubtask = (user) => ORG_CREATE_TASK.includes(user?.role);
export const canDeleteSubtask = (user) => ORG_MANAGE_SUBTASKS.includes(user?.role);
export const canEditSubtaskFully = (user) => ORG_MANAGE_SUBTASKS.includes(user?.role);
export const canUpdateSubtaskStatus = (user, subtask) =>
  ORG_MANAGE_SUBTASKS.includes(user?.role) ||
  (user?.role === "member" && subtask?.assigned_to === user?.id);

export const canDeleteComment = (user, comment) =>
  comment?.user_id === user?.id ||
  comment?.author?.id === user?.id ||
  ORG_MANAGE_SUBTASKS.includes(user?.role);

export const canDeleteAttachment = (user, attachment) =>
  attachment?.uploaded_by === user?.id ||
  attachment?.uploaded_by?.id === user?.id ||
  ORG_MANAGE_SUBTASKS.includes(user?.role);
