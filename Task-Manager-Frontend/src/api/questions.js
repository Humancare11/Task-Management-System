import api from "./client.js";

export function listQuestions(params) {
  return api.get("/questions", { params });
}

export function getQuestion(id) {
  return api.get(`/questions/${id}`);
}

export function createQuestion(data) {
  return api.post("/questions", data);
}

export function resolveQuestion(id) {
  return api.patch(`/questions/${id}/resolve`);
}

export function listAnswers(questionId) {
  return api.get(`/questions/${questionId}/answers`);
}

export function createAnswer(questionId, content) {
  return api.post(`/questions/${questionId}/answers`, { content });
}

export function updateAnswer(questionId, answerId, content) {
  return api.put(`/questions/${questionId}/answers/${answerId}`, { content });
}

export function deleteAnswer(questionId, answerId) {
  return api.delete(`/questions/${questionId}/answers/${answerId}`);
}

export function acceptAnswer(questionId, answerId) {
  return api.patch(`/questions/${questionId}/answers/${answerId}/accept`);
}

export function listQuestionAttachments(questionId) {
  return api.get(`/questions/${questionId}/attachments`);
}

export function uploadQuestionAttachment(questionId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(`/questions/${questionId}/attachments`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function deleteQuestionAttachment(questionId, attachmentId) {
  return api.delete(`/questions/${questionId}/attachments/${attachmentId}`);
}

export function listAnswerAttachments(questionId, answerId) {
  return api.get(`/questions/${questionId}/answers/${answerId}/attachments`);
}

export function uploadAnswerAttachment(questionId, answerId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(
    `/questions/${questionId}/answers/${answerId}/attachments`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
}

export function deleteAnswerAttachment(questionId, answerId, attachmentId) {
  return api.delete(
    `/questions/${questionId}/answers/${answerId}/attachments/${attachmentId}`,
  );
}

export function updateQuestionStatus(id, status) {
  return api.patch(`/questions/${id}/status`, { status });
}
