const User = require("./User");
const Organization = require("./Organization");
const AuthIdentity = require("./AuthIdentity");
const OrganizationMember = require("./OrganizationMember");
const OrganizationInvitation = require("./OrganizationInvitation");
const Project = require("./Project");
const ProjectMember = require("./ProjectMember");
const Task = require("./Task");
const Subtask = require("./Subtask");
const Comment = require("./Comment");
const Tag = require("./Tag");
const Attachment = require("./Attachment");
const Notification = require("./Notification");
const Question = require("./Question");
const QuestionAnswer = require("./QuestionAnswer");

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


// Task ↔ Subtask
Task.hasMany(Subtask, {
  foreignKey: "task_id",
  as: "subtasks",
});

Subtask.belongsTo(Task, {
  foreignKey: "task_id",
  as: "task",
});

// Organization ↔ Subtask
Organization.hasMany(Subtask, {
  foreignKey: "organization_id",
  as: "subtasks",
});

Subtask.belongsTo(Organization, {
  foreignKey: "organization_id",
  as: "organization",
});

// User ↔ Subtask (assigned user)
User.hasMany(Subtask, {
  foreignKey: "assigned_to",
  as: "assignedSubtasks",
});

Subtask.belongsTo(User, {
  foreignKey: "assigned_to",
  as: "assignee",
});

// User ↔ Subtask (creator)
User.hasMany(Subtask, {
  foreignKey: "created_by",
  as: "createdSubtasks",
});

Subtask.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

// Subtask ↔ Comment
Subtask.hasMany(Comment, {
  foreignKey: "subtask_id",
  as: "comments",
});

Comment.belongsTo(Subtask, {
  foreignKey: "subtask_id",
  as: "subtask",
});

// Subtask ↔ Tag (many-to-many through subtask_tags)
Subtask.belongsToMany(Tag, {
  through: "subtask_tags",
  foreignKey: "subtask_id",
  otherKey: "tag_id",
  as: "tags",
});

Tag.belongsToMany(Subtask, {
  through: "subtask_tags",
  foreignKey: "tag_id",
  otherKey: "subtask_id",
  as: "subtasks",
});

// Subtask ↔ Attachment
Subtask.hasMany(Attachment, {
  foreignKey: "subtask_id",
  as: "attachments",
});

Attachment.belongsTo(Subtask, {
  foreignKey: "subtask_id",
  as: "subtask",
});

// Task ↔ Comment
Task.hasMany(Comment, {
  foreignKey: "task_id",
  as: "comments",
});

Comment.belongsTo(Task, {
  foreignKey: "task_id",
  as: "task",
});

// Organization ↔ Comment
Organization.hasMany(Comment, {
  foreignKey: "organization_id",
  as: "comments",
});

Comment.belongsTo(Organization, {
  foreignKey: "organization_id",
  as: "organization",
});

// User ↔ Comment (author)
User.hasMany(Comment, {
  foreignKey: "user_id",
  as: "comments",
});

Comment.belongsTo(User, {
  foreignKey: "user_id",
  as: "author",
});

// Task ↔ Tag (many-to-many through task_tags)
Task.belongsToMany(Tag, {
  through: "task_tags",
  foreignKey: "task_id",
  otherKey: "tag_id",
  as: "tags",
});

Tag.belongsToMany(Task, {
  through: "task_tags",
  foreignKey: "tag_id",
  otherKey: "task_id",
  as: "tasks",
});

// Organization ↔ Tag
Organization.hasMany(Tag, {
  foreignKey: "organization_id",
  as: "tags",
});

Tag.belongsTo(Organization, {
  foreignKey: "organization_id",
  as: "organization",
});

// Task ↔ Attachment
Task.hasMany(Attachment, {
  foreignKey: "task_id",
  as: "attachments",
});

Attachment.belongsTo(Task, {
  foreignKey: "task_id",
  as: "task",
});

// Organization ↔ Attachment
Organization.hasMany(Attachment, {
  foreignKey: "organization_id",
  as: "attachments",
});

Attachment.belongsTo(Organization, {
  foreignKey: "organization_id",
  as: "organization",
});

// User ↔ Attachment
User.hasMany(Attachment, {
  foreignKey: "uploaded_by",
  as: "attachments",
});

Attachment.belongsTo(User, {
  foreignKey: "uploaded_by",
  as: "uploader",
});

// User ↔ Notification (recipient)
User.hasMany(Notification, {
  foreignKey: "user_id",
  as: "notifications",
});

Notification.belongsTo(User, {
  foreignKey: "user_id",
  as: "recipient",
});

// User ↔ Notification (actor)
User.hasMany(Notification, {
  foreignKey: "actor_id",
  as: "triggeredNotifications",
});

Notification.belongsTo(User, {
  foreignKey: "actor_id",
  as: "actor",
});

// Task ↔ Notification
Task.hasMany(Notification, {
  foreignKey: "task_id",
  as: "notifications",
});

Notification.belongsTo(Task, {
  foreignKey: "task_id",
  as: "task",
});

// Organization ↔ Notification
Organization.hasMany(Notification, {
  foreignKey: "organization_id",
  as: "notifications",
});

Notification.belongsTo(Organization, {
  foreignKey: "organization_id",
  as: "organization",
});

// Comment ↔ Attachment
Comment.hasMany(Attachment, {
  foreignKey: "comment_id",
  as: "attachments",
});

Attachment.belongsTo(Comment, {
  foreignKey: "comment_id",
  as: "comment",
});


// Organization ↔ Question

Organization.hasMany(Question, {
  foreignKey: "organization_id",
  as: "questions",
});

Question.belongsTo(Organization, {
  foreignKey: "organization_id",
  as: "organization",
});

// Project ↔ Question

Project.hasMany(Question, {
  foreignKey: "project_id",
  as: "questions",
});

Question.belongsTo(Project, {
  foreignKey: "project_id",
  as: "project",
});

// User ↔ Question (creator)

User.hasMany(Question, {
  foreignKey: "created_by",
  as: "createdQuestions",
});

Question.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

// User ↔ Question (assigned user)

User.hasMany(Question, {
  foreignKey: "assigned_to",
  as: "assignedQuestions",
});

Question.belongsTo(User, {
  foreignKey: "assigned_to",
  as: "assignee",
});

// User ↔ Question (resolver)

User.hasMany(Question, {
  foreignKey: "resolved_by",
  as: "resolvedQuestions",
});

Question.belongsTo(User, {
  foreignKey: "resolved_by",
  as: "resolver",
});

// Question ↔ QuestionAnswer
Question.hasMany(QuestionAnswer, {
  foreignKey: "question_id",
  as: "answers",
});

QuestionAnswer.belongsTo(Question, {
  foreignKey: "question_id",
  as: "question",
});

// User ↔ QuestionAnswer
User.hasMany(QuestionAnswer, {
  foreignKey: "user_id",
  as: "questionAnswers",
});

QuestionAnswer.belongsTo(User, {
  foreignKey: "user_id",
  as: "author",
});

// Organization ↔ QuestionAnswer
Organization.hasMany(QuestionAnswer, {
  foreignKey: "organization_id",
  as: "questionAnswers",
});

QuestionAnswer.belongsTo(Organization, {
  foreignKey: "organization_id",
  as: "organization",
});

// Question ↔ Attachment
Question.hasMany(Attachment, {
  foreignKey: "question_id",
  as: "attachments",
});

Attachment.belongsTo(Question, {
  foreignKey: "question_id",
  as: "question",
});

// QuestionAnswer ↔ Attachment
QuestionAnswer.hasMany(Attachment, {
  foreignKey: "question_answer_id",
  as: "attachments",
});

Attachment.belongsTo(QuestionAnswer, {
  foreignKey: "question_answer_id",
  as: "questionAnswer",
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
  Subtask,
  Comment,
  Tag,
  Attachment,
  Notification,
  Question,
  QuestionAnswer,
};