const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const {
    uploadQuestionAttachment,
    getQuestionAttachments,
    deleteQuestionAttachment,
    uploadAnswerAttachment,
    getAnswerAttachments,
    deleteAnswerAttachment,
} = require("../controllers/questionAttachmentController");

const upload = require("../middleware/upload");

const {
    createQuestion,
    getQuestions,
    getQuestionById,
    createAnswer,
    getAnswers,
    updateAnswer,
    deleteAnswer,
    acceptAnswer,
    resolveQuestion,
    updateQuestionStatus,
} = require("../controllers/questionController");

router.use(requireAuth);

// Create a question
router.post(
    "/",
    requireRole("owner", "admin", "manager", "member", "client"),
    createQuestion
);

// Get all questions for current organization
router.get(
    "/",
    requireRole("owner", "admin", "manager", "member", "client"),
    getQuestions
);

// Get single question by ID
router.get(
    "/:id",
    requireRole("owner", "admin", "manager", "member", "client"),
    getQuestionById
);

// Create an answer to a question
router.post(
    "/:questionId/answers",
    requireRole("owner", "admin", "manager", "member", "client"),
    createAnswer
);

// Get answers for a question
router.get(
    "/:questionId/answers",
    requireRole("owner", "admin", "manager", "member", "client"),
    getAnswers
);

// Update an answer
router.put(
    "/:questionId/answers/:answerId",
    requireRole("owner", "admin", "manager", "member", "client"),
    updateAnswer
);

// Delete an answer
router.delete(
    "/:questionId/answers/:answerId",
    requireRole("owner", "admin", "manager", "member", "client"),
    deleteAnswer
);

// Accept an answer
router.patch(
    "/:questionId/answers/:answerId/accept",
    requireRole("owner", "admin", "manager", "member", "client"),
    acceptAnswer
);

// Resolve a question
router.patch(
    "/:id/resolve",
    requireRole("owner", "admin", "manager", "member", "client"),
    resolveQuestion
);

// Update status of a question
router.patch(
    "/:id/status",
    requireRole("owner", "admin", "manager", "member", "client"),
    updateQuestionStatus
);

// Question attachments
router.get(
    "/:questionId/attachments",
    requireRole("owner", "admin", "manager", "member", "client"),
    getQuestionAttachments
);

router.post(
    "/:questionId/attachments",
    requireRole("owner", "admin", "manager", "member"),
    upload.single("file"),
    uploadQuestionAttachment
);

router.delete(
    "/:questionId/attachments/:attachmentId",
    requireRole("owner", "admin", "manager", "member"),
    deleteQuestionAttachment
);

// Answer attachments
router.get(
    "/:questionId/answers/:answerId/attachments",
    requireRole("owner", "admin", "manager", "member", "client"),
    getAnswerAttachments
);

router.post(
    "/:questionId/answers/:answerId/attachments",
    requireRole("owner", "admin", "manager", "member"),
    upload.single("file"),
    uploadAnswerAttachment
);

router.delete(
    "/:questionId/answers/:answerId/attachments/:attachmentId",
    requireRole("owner", "admin", "manager", "member"),
    deleteAnswerAttachment
);
module.exports = router;