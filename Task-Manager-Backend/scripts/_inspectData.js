require("dotenv").config();
const { sequelize } = require("../config/db");
const { User, Organization, OrganizationMember, Project, Task, Subtask } = require("../models");

async function main() {
  await sequelize.authenticate();

  const orgs = await Organization.findAll({ attributes: ["id", "name"], limit: 5 });
  console.log("ORGS:", JSON.stringify(orgs, null, 2));

  for (const org of orgs) {
    const members = await OrganizationMember.findAll({
      where: { organization_id: org.id },
      include: [{ model: User, as: "user", attributes: ["id", "first_name", "email"] }],
    });
    console.log(`\nORG ${org.id} (${org.name}) members:`);
    members.forEach((m) => console.log(`  user=${m.user_id} role=${m.role} email=${m.user?.email}`));
  }

  const projects = await Project.findAll({ attributes: ["id", "name", "organization_id"], limit: 10 });
  console.log("\nPROJECTS:", JSON.stringify(projects, null, 2));

  const tasks = await Task.findAll({ attributes: ["id", "title", "project_id", "organization_id", "assigned_to"], limit: 10 });
  console.log("\nTASKS:", JSON.stringify(tasks, null, 2));

  const subtasks = await Subtask.findAll({ attributes: ["id", "title", "task_id", "organization_id", "assigned_to"], limit: 10 });
  console.log("\nSUBTASKS:", JSON.stringify(subtasks, null, 2));

  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
