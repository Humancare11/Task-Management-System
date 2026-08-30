const { ProjectMember, Project, User, OrganizationMember } = require("../models");
const { createActivity } = require("../utils/activity");

// POST /api/projects/:projectId/members
exports.addProjectMember = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { user_id, role = "member" } = req.body;

    if (!user_id) {
      return res.status(400).json({
        message: "user_id is required.",
      });
    }

    // Find the project inside the logged-in user's organization.
    const project = await Project.findOne({
      where: {
        id: projectId,
        organization_id: req.user.organization_id,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    // User must already belong to the organization.
    const organizationMember = await OrganizationMember.findOne({
      where: {
        organization_id: req.user.organization_id,
        user_id,
        is_active: true,
      },
    });

    if (!organizationMember) {
      return res.status(400).json({
        message: "User is not an active member of this organization.",
      });
    }

    // Prevent duplicate project membership.
    const existingMember = await ProjectMember.findOne({
      where: {
        project_id: project.id,
        user_id,
      },
    });

    if (existingMember) {
      return res.status(409).json({
        message: "User is already a member of this project.",
      });
    }

    const projectMember = await ProjectMember.create({
      project_id: project.id,
      user_id,
      role,
    });

    const memberUser = await User.findByPk(user_id, {
      attributes: ["id", "first_name", "last_name"],
    });
    const memberName = memberUser
      ? `${memberUser.first_name ?? ""} ${memberUser.last_name ?? ""}`.trim()
      : "A member";

    await createActivity({
      organization_id: req.user.organization_id,
      project_id: project.id,
      task_id: null,
      user_id: req.user.id,
      entity_type: "member",
      entity_id: projectMember.id,
      action: "created",
      description: `Added ${memberName} to the project`,
      metadata: {
        member_id: projectMember.id,
        member_user_id: user_id,
        member_name: memberName,
        project_id: project.id,
        role,
      },
    });

    res.status(201).json({
      message: "Project member added successfully.",
      member: projectMember,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server error while adding project member.",
    });
  }
};