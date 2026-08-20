import api from "./client.js";

export const getInvitations = () => api.get("/invitations");

export const createInvitation = (data) => api.post("/invitations", data);

export const cancelInvitation = (id) => api.delete(`/invitations/${id}`);

export const resendInvitation = (id) => api.post(`/invitations/${id}/resend`);
