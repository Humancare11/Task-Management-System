const path = require("path");
const fs = require("fs");

const {
    Attachment,
    Question,
    QuestionAnswer,
    User,
} = require("../models");

async function resolveQuestionContext(req) {
    const { questionId } = req.params;

    const question = await Question.findOne({
        where: {
            id: questionId,
            organization_id: req.user.organization_id,
        },
    });

    if (!question) {
        return {
            error: {
                status: 404,
                message: "Question not found.",
            },
        };
    }

    return { question };
}

// POST /api/questions/:questionId/attachments
exports.uploadQuestionAttachment = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "No file uploaded.",
            });
        }

        const { error, question } = await resolveQuestionContext(req);

        if (error) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        const attachment = await Attachment.create({
            task_id: null,
            subtask_id: null,
            comment_id: null,
            question_id: question.id,
            question_answer_id: null,

            organization_id: req.user.organization_id,
            uploaded_by: req.user.id,

            file_name: req.file.originalname,
            file_path: req.file.filename,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
        });

        return res.status(201).json({
            message: "Question attachment uploaded successfully.",
            attachment: {
                id: attachment.id,
                file_name: attachment.file_name,
                file_size: attachment.file_size,
                mime_type: attachment.mime_type,
                url: `/uploads/${attachment.file_path}`,
                created_at: attachment.created_at,
            },
        });
    } catch (error) {
        console.error("Upload question attachment error:", error);

        return res.status(500).json({
            message: "Server error while uploading question attachment.",
        });
    }
};

// GET /api/questions/:questionId/attachments
exports.getQuestionAttachments = async (req, res) => {
    try {
        const { error, question } = await resolveQuestionContext(req);

        if (error) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        const attachments = await Attachment.findAll({
            where: {
                question_id: question.id,
                question_answer_id: null,
                organization_id: req.user.organization_id,
            },
            include: [
                {
                    model: User,
                    as: "uploader",
                    attributes: [
                        "id",
                        "first_name",
                        "last_name",
                        "email",
                    ],
                },
            ],
            order: [["created_at", "ASC"]],
        });

        return res.json({
            attachments: attachments.map((attachment) => ({
                id: attachment.id,
                file_name: attachment.file_name,
                file_size: attachment.file_size,
                mime_type: attachment.mime_type,
                url: `/uploads/${attachment.file_path}`,
                uploaded_by: attachment.uploader,
                created_at: attachment.created_at,
            })),
        });
    } catch (error) {
        console.error("Get question attachments error:", error);

        return res.status(500).json({
            message: "Server error while fetching question attachments.",
        });
    }
};

// DELETE /api/questions/:questionId/attachments/:attachmentId
exports.deleteQuestionAttachment = async (req, res) => {
    try {
        const { questionId, attachmentId } = req.params;

        const { error, question } = await resolveQuestionContext(req);

        if (error) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        const attachment = await Attachment.findOne({
            where: {
                id: attachmentId,
                question_id: question.id,
                question_answer_id: null,
                organization_id: req.user.organization_id,
            },
        });

        if (!attachment) {
            return res.status(404).json({
                message: "Attachment not found.",
            });
        }

        const canDelete =
            attachment.uploaded_by === req.user.id ||
            ["owner", "admin", "manager"].includes(req.user.role);

        if (!canDelete) {
            return res.status(403).json({
                message: "You cannot delete this attachment.",
            });
        }

        const filePath = path.join(
            __dirname,
            "../uploads",
            attachment.file_path,
        );

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await attachment.destroy();

        return res.json({
            message: "Question attachment deleted.",
        });
    } catch (error) {
        console.error("Delete question attachment error:", error);

        return res.status(500).json({
            message: "Server error while deleting question attachment.",
        });
    }
};


async function resolveAnswerContext(req) {
    const { questionId, answerId } = req.params;

    const question = await Question.findOne({
        where: {
            id: questionId,
            organization_id: req.user.organization_id,
        },
    });

    if (!question) {
        return {
            error: {
                status: 404,
                message: "Question not found.",
            },
        };
    }

    const answer = await QuestionAnswer.findOne({
        where: {
            id: answerId,
            question_id: question.id,
            organization_id: req.user.organization_id,
        },
    });

    if (!answer) {
        return {
            error: {
                status: 404,
                message: "Answer not found.",
            },
        };
    }

    return {
        question,
        answer,
    };
}


// POST /api/questions/:questionId/answers/:answerId/attachments
exports.uploadAnswerAttachment = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "No file uploaded.",
            });
        }

        const { error, answer } = await resolveAnswerContext(req);

        if (error) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        const attachment = await Attachment.create({
            task_id: null,
            subtask_id: null,
            comment_id: null,
            question_id: null,
            question_answer_id: answer.id,

            organization_id: req.user.organization_id,
            uploaded_by: req.user.id,

            file_name: req.file.originalname,
            file_path: req.file.filename,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
        });

        return res.status(201).json({
            message: "Answer attachment uploaded successfully.",
            attachment: {
                id: attachment.id,
                file_name: attachment.file_name,
                file_size: attachment.file_size,
                mime_type: attachment.mime_type,
                url: `/uploads/${attachment.file_path}`,
                created_at: attachment.created_at,
            },
        });
    } catch (error) {
        console.error("Upload answer attachment error:", error);

        return res.status(500).json({
            message: "Server error while uploading answer attachment.",
        });
    }
};

// GET /api/questions/:questionId/answers/:answerId/attachments
exports.getAnswerAttachments = async (req, res) => {
    try {
        const { error, answer } = await resolveAnswerContext(req);

        if (error) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        const attachments = await Attachment.findAll({
            where: {
                question_answer_id: answer.id,
                organization_id: req.user.organization_id,
            },
            include: [
                {
                    model: User,
                    as: "uploader",
                    attributes: [
                        "id",
                        "first_name",
                        "last_name",
                        "email",
                    ],
                },
            ],
            order: [["created_at", "ASC"]],
        });

        return res.json({
            attachments: attachments.map((attachment) => ({
                id: attachment.id,
                file_name: attachment.file_name,
                file_size: attachment.file_size,
                mime_type: attachment.mime_type,
                url: `/uploads/${attachment.file_path}`,
                uploaded_by: attachment.uploader,
                created_at: attachment.created_at,
            })),
        });
    } catch (error) {
        console.error("Get answer attachments error:", error);

        return res.status(500).json({
            message: "Server error while fetching answer attachments.",
        });
    }
};

// DELETE /api/questions/:questionId/answers/:answerId/attachments/:attachmentId
exports.deleteAnswerAttachment = async (req, res) => {
    try {
        const { attachmentId } = req.params;

        const { error, answer } = await resolveAnswerContext(req);

        if (error) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        const attachment = await Attachment.findOne({
            where: {
                id: attachmentId,
                question_answer_id: answer.id,
                organization_id: req.user.organization_id,
            },
        });

        if (!attachment) {
            return res.status(404).json({
                message: "Attachment not found.",
            });
        }

        const canDelete =
            attachment.uploaded_by === req.user.id ||
            ["owner", "admin", "manager"].includes(req.user.role);

        if (!canDelete) {
            return res.status(403).json({
                message: "You cannot delete this attachment.",
            });
        }

        const filePath = path.join(
            __dirname,
            "../uploads",
            attachment.file_path,
        );

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await attachment.destroy();

        return res.json({
            message: "Answer attachment deleted.",
        });
    } catch (error) {
        console.error("Delete answer attachment error:", error);

        return res.status(500).json({
            message: "Server error while deleting answer attachment.",
        });
    }
};