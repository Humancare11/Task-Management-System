const { ProjectMember, Project, User, OrganizationMember } = require("../models");

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