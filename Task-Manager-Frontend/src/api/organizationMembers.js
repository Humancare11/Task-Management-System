import api from "./client.js";

export const listOrganizationMembers = () => api.get("/organization/members");
