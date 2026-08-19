const User = require("./User");
const Organization = require("./Organization");
const AuthIdentity = require("./AuthIdentity");
const OrganizationMember = require("./OrganizationMember");
const OrganizationInvitation = require("./OrganizationInvitation");
const Project = require("./Project");
const ProjectMember = require("./ProjectMember");
const Task = require("./Task");

// User ↔ AuthIdentity
User.hasMany(AuthIdentity, {
  foreignKey: "user_id",
  as: "authIdentities",
});

AuthIdentity.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// User ↔ OrganizationMember
User.hasMany(OrganizationMember, {
  foreignKey: "user_id",
  as: "organizationMemberships",
});

OrganizationMember.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// Organization ↔ OrganizationMember
Organization.hasMany(OrganizationMember, {
  foreignKey: "organization_id",
  as: "members",
});

OrganizationMember.belongsTo(Organization, {
  foreignKey: "organization_id",
  as: "organization",
});

// User ↔ Organization
User.belongsToMany(Organization, {
  through: OrganizationMember,
  foreignKey: "user_id",
  otherKey: "organization_id",
  as: "organizations",
});

Organization.belongsToMany(User, {
  through: OrganizationMember,
  foreignKey: "organization_id",
  otherKey: "user_id",
  as: "users",
});

// Organization ↔ OrganizationInvitation
Organization.hasMany(OrganizationInvitation, {
  foreignKey: "organization_id",
  as: "invitations",
});

OrganizationInvitation.belongsTo(Organization, {
  foreignKey: "organization_id",
  as: "organization",
});

// User ↔ OrganizationInvitation
User.hasMany(OrganizationInvitation, {
  foreignKey: "invited_by",
  as: "sentInvitations",
});

OrganizationInvitation.belongsTo(User, {
  foreignKey: "invited_by",
  as: "inviter",
});

// Organization ↔ Project
Organization.hasMany(Project, {
  foreignKey: "organization_id",
  as: "projects",
});

Project.belongsTo(Organization, {
  foreignKey: "organization_id",
  as: "organization",
});

// User ↔ Project
User.hasMany(Project, {
  foreignKey: "created_by",
  as: "createdProjects",
});

Project.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

// Project ↔ ProjectMember
Project.hasMany(ProjectMember, {
  foreignKey: "project_id",
  as: "members",
});

ProjectMember.belongsTo(Project, {
  foreignKey: "project_id",
  as: "project",
});

// User ↔ ProjectMember
User.hasMany(ProjectMember, {
  foreignKey: "user_id",
  as: "projectMemberships",
});

ProjectMember.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});


// Project ↔ Task
Project.hasMany(Task, {
  foreignKey: "project_id",
  as: "tasks",
});

Task.belongsTo(Project, {
  foreignKey: "project_id",
  as: "project",
});

// Organization ↔ Task
Organization.hasMany(Task, {
  foreignKey: "organization_id",
  as: "tasks",
});

Task.belongsTo(Organization, {
  foreignKey: "organization_id",
  as: "organization",
});

// User ↔ Task (assigned user)
User.hasMany(Task, {
  foreignKey: "assigned_to",
  as: "assignedTasks",
});

Task.belongsTo(User, {
  foreignKey: "assigned_to",
  as: "assignee",
});

// User ↔ Task (creator)
User.hasMany(Task, {
  foreignKey: "created_by",
  as: "createdTasks",
});

Task.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});
module.exports = {
  User,
  Organization,
  AuthIdentity,
  OrganizationMember,
  OrganizationInvitation,
  Project,
  ProjectMember,
  Task,
};