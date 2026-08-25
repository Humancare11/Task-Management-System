const {
    Question,
    QuestionAnswer,
    Project,
    User,
} = require("../models");

exports.createQuestion = async (req, res) => {
    try {
        const {
            title,
            description,
            category,
            priority,
            visibility,
            project_id,
            assigned_to,
        } = req.body;

        // 1. Validate title
        if (!title || !title.trim()) {
            return res.status(400).json({
                message: "Question title is required.",
            });
        }

        // 2. Validate description
        if (!description || !description.trim()) {
            return res.status(400).json({
                message: "Question description is required.",
            });
        }

        // 3. Validate project if provided
        if (project_id !== undefined && project_id !== null) {
            const project = await Project.findOne({
                where: {
                    id: project_id,
                    organization_id: req.user.organization_id,
                },
            });

            if (!project) {
                return res.status(404).json({
                    message: "Project not found.",
                });
            }
        }

        // 4. Validate category
        const allowedCategories = [
            "technical",
            "bug",
            "task_related",
            "project",
            "account",
            "general",
            "other",
        ];

        if (category && !allowedCategories.includes(category)) {
            return res.status(400).json({
                message: "Invalid question category.",
            });
        }

        // 5. Validate priority
        const allowedPriorities = [
            "low",
            "medium",
            "high",
            "urgent",
        ];

        if (priority && !allowedPriorities.includes(priority)) {
            return res.status(400).json({
                message: "Invalid question priority.",
            });
        }

        // 6. Validate visibility
        const allowedVisibility = [
            "organization",
            "project",
            "private",
        ];

        if (visibility && !allowedVisibility.includes(visibility)) {
            return res.status(400).json({
                message: "Invalid question visibility.",
            });
        }

        // 7. Create question
        const question = await Question.create({
            organization_id: req.user.organization_id,
            project_id: project_id || null,
            created_by: req.user.id,
            assigned_to: assigned_to || null,
            title: title.trim(),
            description: description.trim(),

            category: category || "general",
            priority: priority || "medium",
            visibility: visibility || "organization",

            // Always start as open
            status: "open",

            resolved_by: null,
            resolved_at: null,
        });

        return res.status(201).json({
            message: "Question created successfully.",
            question,
        });
    } catch (error) {
        console.error("Create question error:", error);

        return res.status(500).json({
            message: "Server error while creating question.",
        });
    }
};


exports.getQuestions = async (req, res) => {
    try {
        const { status, priority, category, project_id } = req.query;

        const where = {
            organization_id: req.user.organization_id,
        };

        // Optional filters
        if (status) {
            where.status = status;
        }

        if (priority) {
            where.priority = priority;
        }

        if (category) {
            where.category = category;
        }

        if (project_id) {
            where.project_id = project_id;
        }

        const questions = await Question.findAll({
            where,

            include: [
                {
                    model: Project,
                    as: "project",
                    attributes: ["id", "name"],
                    required: false,
                },
            ],

            order: [["created_at", "DESC"]],
        });

        return res.json({
            questions,
        });
    } catch (error) {
        console.error("Get questions error:", error);

        return res.status(500).json({
            message: "Server error while fetching questions.",
        });
    }
};

exports.getQuestionById = async (req, res) => {
    try {
        const { id } = req.params;

        const question = await Question.findOne({
            where: {
                id,
                organization_id: req.user.organization_id,
            },

            include: [
                {
                    model: Project,
                    as: "project",
                    attributes: ["id", "name"],
                    required: false,
                },
            ],
        });

        if (!question) {
            return res.status(404).json({
                message: "Question not found.",
            });
        }

        return res.json({
            question,
        });
    } catch (error) {
        console.error("Get question error:", error);

        return res.status(500).json({
            message: "Server error while fetching question.",
        });
    }
};

exports.createAnswer = async (req, res) => {
    try {
        const { questionId } = req.params;
        const { content } = req.body;

        // 1. Validate content
        if (!content || !content.trim()) {
            return res.status(400).json({
                message: "Answer content is required.",
            });
        }

        // 2. Verify question belongs to user's organization
        const question = await Question.findOne({
            where: {
                id: questionId,
                organization_id: req.user.organization_id,
            },
        });

        if (!question) {
            return res.status(404).json({
                message: "Question not found.",
            });
        }

        // 3. Create answer
        const answer = await QuestionAnswer.create({
            question_id: question.id,
            organization_id: req.user.organization_id,
            user_id: req.user.id,
            content: content.trim(),
            is_accepted: false,
        });

        return res.status(201).json({
            message: "Answer added successfully.",
            answer,
        });
    } catch (error) {
        console.error("Create answer error:", error);

        return res.status(500).json({
            message: "Server error while creating answer.",
        });
    }
};


exports.getAnswers = async (req, res) => {
    try {
        const { questionId } = req.params;

        // 1. Verify question belongs to current organization
        const question = await Question.findOne({
            where: {
                id: questionId,
                organization_id: req.user.organization_id,
            },
        });

        if (!question) {
            return res.status(404).json({
                message: "Question not found.",
            });
        }

        // 2. Get answers
        const answers = await QuestionAnswer.findAll({
            where: {
                question_id: question.id,
                organization_id: req.user.organization_id,
            },

            include: [
                {
                    model: User,
                    as: "author",
                    attributes: [
                        "id",
                        "first_name",
                        "last_name",
                        "email",
                        "avatar_url",
                    ],
                },
            ],

            order: [["created_at", "ASC"]],
        });

        return res.json({
            answers,
        });
    } catch (error) {
        console.error("Get answers error:", error);

        return res.status(500).json({
            message: "Server error while fetching answers.",
        });
    }
};

exports.updateAnswer = async (req, res) => {
    try {
        const { questionId, answerId } = req.params;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({
                message: "Answer content is required.",
            });
        }

        // Verify question belongs to current organization
        const question = await Question.findOne({
            where: {
                id: questionId,
                organization_id: req.user.organization_id,
            },
        });

        if (!question) {
            return res.status(404).json({
                message: "Question not found.",
            });
        }

        // Find answer
        const answer = await QuestionAnswer.findOne({
            where: {
                id: answerId,
                question_id: question.id,
                organization_id: req.user.organization_id,
            },
        });

        if (!answer) {
            return res.status(404).json({
                message: "Answer not found.",
            });
        }

        // Only author or management can edit
        const canEdit =
            answer.user_id === req.user.id ||
            ["owner", "admin", "manager"].includes(req.user.role);

        if (!canEdit) {
            return res.status(403).json({
                message: "You cannot edit this answer.",
            });
        }

        answer.content = content.trim();

        await answer.save();

        return res.json({
            message: "Answer updated successfully.",
            answer,
        });
    } catch (error) {
        console.error("Update answer error:", error);

        return res.status(500).json({
            message: "Server error while updating answer.",
        });
    }
};

exports.deleteAnswer = async (req, res) => {
    try {
        const { questionId, answerId } = req.params;

        // Verify question belongs to current organization
        const question = await Question.findOne({
            where: {
                id: questionId,
                organization_id: req.user.organization_id,
            },
        });

        if (!question) {
            return res.status(404).json({
                message: "Question not found.",
            });
        }

        const answer = await QuestionAnswer.findOne({
            where: {
                id: answerId,
                question_id: question.id,
                organization_id: req.user.organization_id,
            },
        });

        if (!answer) {
            return res.status(404).json({
                message: "Answer not found.",
            });
        }

        // Only author or management can delete
        const canDelete =
            answer.user_id === req.user.id ||
            ["owner", "admin", "manager"].includes(req.user.role);

        if (!canDelete) {
            return res.status(403).json({
                message: "You cannot delete this answer.",
            });
        }

        await answer.destroy();

        return res.json({
            message: "Answer deleted successfully.",
        });
    } catch (error) {
        console.error("Delete answer error:", error);

        return res.status(500).json({
            message: "Server error while deleting answer.",
        });
    }
};

exports.acceptAnswer = async (req, res) => {
    try {
        const { questionId, answerId } = req.params;

        // 1. Find question
        const question = await Question.findOne({
            where: {
                id: questionId,
                organization_id: req.user.organization_id,
            },
        });

        if (!question) {
            return res.status(404).json({
                message: "Question not found.",
            });
        }

        // 2. Only question creator can accept an answer
        if (question.created_by !== req.user.id) {
            return res.status(403).json({
                message: "Only the question creator can accept an answer.",
            });
        }

        // 3. Find answer
        const answer = await QuestionAnswer.findOne({
            where: {
                id: answerId,
                question_id: question.id,
                organization_id: req.user.organization_id,
            },
        });

        if (!answer) {
            return res.status(404).json({
                message: "Answer not found.",
            });
        }

        // 4. Remove accepted status from other answers
        await QuestionAnswer.update(
            {
                is_accepted: false,
            },
            {
                where: {
                    question_id: question.id,
                    organization_id: req.user.organization_id,
                },
            }
        );

        // 5. Accept selected answer
        answer.is_accepted = true;
        await answer.save();

        return res.json({
            message: "Answer accepted successfully.",
            answer,
        });
    } catch (error) {
        console.error("Accept answer error:", error);

        return res.status(500).json({
            message: "Server error while accepting answer.",
        });
    }
};

exports.resolveQuestion = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Find question in current organization
        const question = await Question.findOne({
            where: {
                id,
                organization_id: req.user.organization_id,
            },
        });

        if (!question) {
            return res.status(404).json({
                message: "Question not found.",
            });
        }

        // 2. Check permission
        const canResolve =
            question.created_by === req.user.id ||
            question.assigned_to === req.user.id ||
            ["owner", "admin", "manager", "member"].includes(req.user.role);

        if (!canResolve) {
            return res.status(403).json({
                message: "You do not have permission to resolve this question.",
            });
        }

        // 3. Check if already resolved
        if (question.status === "resolved") {
            return res.status(400).json({
                message: "Question is already resolved.",
            });
        }

        // 4. Check for accepted answer
        const acceptedAnswer = await QuestionAnswer.findOne({
            where: {
                question_id: question.id,
                organization_id: req.user.organization_id,
                is_accepted: true,
            },
        });

        if (!acceptedAnswer) {
            return res.status(400).json({
                message: "Please accept an answer before resolving the question.",
            });
        }

        // 5. Resolve question
        question.status = "resolved";
        question.resolved_by = req.user.id;
        question.resolved_at = new Date();

        await question.save();

        return res.json({
            message: "Question resolved successfully.",
            question,
        });
    } catch (error) {
        console.error("Resolve question error:", error);

        return res.status(500).json({
            message: "Server error while resolving question.",
        });
    }
};

exports.updateQuestionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = ["open", "in_progress", "resolved"];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Invalid status value. Must be 'open', 'in_progress', or 'resolved'.",
            });
        }

        const question = await Question.findOne({
            where: {
                id,
                organization_id: req.user.organization_id,
            },
        });

        if (!question) {
            return res.status(404).json({
                message: "Question not found.",
            });
        }

        const canUpdate =
            question.created_by === req.user.id ||
            question.assigned_to === req.user.id ||
            ["owner", "admin", "manager", "member"].includes(req.user.role);

        if (!canUpdate) {
            return res.status(403).json({
                message: "You do not have permission to update the status of this question.",
            });
        }

        if (status === "resolved") {
            const acceptedAnswer = await QuestionAnswer.findOne({
                where: {
                    question_id: question.id,
                    organization_id: req.user.organization_id,
                    is_accepted: true,
                },
            });

            if (!acceptedAnswer) {
                return res.status(400).json({
                    message: "Please accept an answer before resolving the question.",
                });
            }

            question.status = "resolved";
            question.resolved_by = req.user.id;
            question.resolved_at = new Date();
        } else {
            question.status = status;
            question.resolved_by = null;
            question.resolved_at = null;
        }

        await question.save();

        return res.json({
            message: `Question status updated to ${status} successfully.`,
            question,
        });
    } catch (error) {
        console.error("Update question status error:", error);
        return res.status(500).json({
            message: "Server error while updating question status.",
        });
    }
};