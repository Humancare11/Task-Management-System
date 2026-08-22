Thought for 1m 19s

Two files, same pattern as the board.
Backend

STEP 1 — subtaskController.js: add a reload helper + socket import

Find:
js

const {
Subtask,
Task,
Project,
ProjectMember,
User,
} = require("../models");

exports.createSubtask = async (req, res) => {

Replace:
js

const {
Subtask,
Task,
Project,
ProjectMember,
User,
} = require("../models");
const { getIO } = require("../socket");

async function loadSubtaskWithUsers(subtaskId) {
return Subtask.findOne({
where: { id: subtaskId },
include: [
{
model: User,
as: "assignee",
attributes: ["id", "first_name", "last_name", "email", "avatar_url"],
},
{
model: User,
as: "creator",
attributes: ["id", "first_name", "last_name", "email"],
},
],
});
}

exports.createSubtask = async (req, res) => {

This helper is worth the extra reload — your createSubtask currently returns the bare row with no assignee/creator, but getSubtasks (and the UI's avatar rendering) expects those included. Without it, a subtask that arrives live would render without its assignee avatar until the page refreshed.

STEP 2 — createSubtask: reload + emit

Find:
js

    // 5. Create subtask
    const subtask = await Subtask.create({
      task_id: task.id,
      organization_id: req.user.organization_id,
      title: title.trim(),
      description: description || null,
      assigned_to: assigned_to || null,
      created_by: req.user.id,
      status: "todo",
    });

    return res.status(201).json({
      message: "Subtask created successfully.",
      subtask,
    });

Replace:
js

    // 5. Create subtask
    const subtask = await Subtask.create({
      task_id: task.id,
      organization_id: req.user.organization_id,
      title: title.trim(),
      description: description || null,
      assigned_to: assigned_to || null,
      created_by: req.user.id,
      status: "todo",
    });

    const full = await loadSubtaskWithUsers(subtask.id);

    try {
      getIO().to(`task:${taskId}`).emit("subtask:created", full);
    } catch (err) {
      console.error("Socket emit failed:", err.message);
    }

    return res.status(201).json({
      message: "Subtask created successfully.",
      subtask: full,
    });

STEP 3 — updateSubtask, member-only status branch

Find:
js

      subtask.status = status;

      await subtask.save();

      return res.json({
        message: "Subtask status updated successfully.",
        subtask,
      });
    }

Replace:
js

      subtask.status = status;

      await subtask.save();

      const full = await loadSubtaskWithUsers(subtask.id);

      try {
        getIO().to(`task:${taskId}`).emit("subtask:updated", full);
      } catch (err) {
        console.error("Socket emit failed:", err.message);
      }

      return res.json({
        message: "Subtask status updated successfully.",
        subtask: full,
      });
    }

STEP 4 — updateSubtask, owner/admin/manager branch

Find:
js

    await subtask.save();

    return res.json({
      message: "Subtask updated successfully.",
      subtask,
    });

} catch (error) {
console.error("Update subtask error:", error);

Replace:
js

    await subtask.save();

    const full = await loadSubtaskWithUsers(subtask.id);

    try {
      getIO().to(`task:${taskId}`).emit("subtask:updated", full);
    } catch (err) {
      console.error("Socket emit failed:", err.message);
    }

    return res.json({
      message: "Subtask updated successfully.",
      subtask: full,
    });

} catch (error) {
console.error("Update subtask error:", error);

STEP 5 — deleteSubtask

Find:
js

    // 5. Delete subtask
    await subtask.destroy();

    return res.json({
      message: "Subtask deleted successfully.",
    });

Replace:
js

    // 5. Delete subtask
    const deletedSubtaskId = subtask.id;
    await subtask.destroy();

    try {
      getIO().to(`task:${taskId}`).emit("subtask:deleted", { subtaskId: deletedSubtaskId });
    } catch (err) {
      console.error("Socket emit failed:", err.message);
    }

    return res.json({
      message: "Subtask deleted successfully.",
    });

STEP 6 — commentController.js: add socket import

Find:
js

const { Comment, Task, Project, User } = require("../models");
const { createNotification } = require("../utils/notify");

Replace:
js

const { Comment, Task, Project, User } = require("../models");
const { createNotification } = require("../utils/notify");
const { getIO } = require("../socket");

STEP 7 — createComment: emit after the notification

Find:
js

      message: `${actor?.first_name || "Someone"} commented on "${task.title}"`,
      });
    }

    return res.status(201).json({ message: "Comment created.", comment: full });

Replace:
js

      message: `${actor?.first_name || "Someone"} commented on "${task.title}"`,
      });
    }

    try {
      getIO().to(`task:${taskId}`).emit("comment:created", full);
    } catch (err) {
      console.error("Socket emit failed:", err.message);
    }

    return res.status(201).json({ message: "Comment created.", comment: full });

STEP 8 — deleteComment

Find:
js

    await comment.destroy();
    return res.json({ message: "Comment deleted." });

Replace:
js

    const deletedCommentId = comment.id;
    await comment.destroy();

    try {
      getIO().to(`task:${taskId}`).emit("comment:deleted", { commentId: deletedCommentId });
    } catch (err) {
      console.error("Socket emit failed:", err.message);
    }

    return res.json({ message: "Comment deleted." });

Frontend — TaskDetails.jsx

STEP 9 — import the socket

Find:
js

import { listProjectMembers } from "../../api/projectMembers.js";
import { useAuth } from "../../context/AuthContext.jsx";

Replace:
js

import { listProjectMembers } from "../../api/projectMembers.js";
import { getSocket } from "../../lib/socket.js";
import { useAuth } from "../../context/AuthContext.jsx";

STEP 10 — join the task room, listen for live events

Find:
js

useEffect(() => {
fetchAll();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [projectId, taskId]);

// Focus add-input when form opens

Replace:
js

useEffect(() => {
fetchAll();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [projectId, taskId]);

useEffect(() => {
const socket = getSocket();
socket.emit("task:join", taskId);

    function handleSubtaskCreated(subtask) {
      setSubtasks((prev) =>
        prev.some((s) => s.id === subtask.id) ? prev : [...prev, subtask],
      );
    }
    function handleSubtaskUpdated(subtask) {
      setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? subtask : s)));
    }
    function handleSubtaskDeleted({ subtaskId }) {
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    }

    function handleCommentCreated(comment) {
      setComments((prev) =>
        prev.some((c) => c.id === comment.id) ? prev : [...prev, comment],
      );
    }
    function handleCommentDeleted({ commentId }) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }

    socket.on("subtask:created", handleSubtaskCreated);
    socket.on("subtask:updated", handleSubtaskUpdated);
    socket.on("subtask:deleted", handleSubtaskDeleted);
    socket.on("comment:created", handleCommentCreated);
    socket.on("comment:deleted", handleCommentDeleted);

    return () => {
      socket.emit("task:leave", taskId);
      socket.off("subtask:created", handleSubtaskCreated);
      socket.off("subtask:updated", handleSubtaskUpdated);
      socket.off("subtask:deleted", handleSubtaskDeleted);
      socket.off("comment:created", handleCommentCreated);
      socket.off("comment:deleted", handleCommentDeleted);
    };

}, [taskId]);

// Focus add-input when form opens

The prev.some(...) ? prev : [...] guard on the created handlers matters: the person performing the action already appends it locally from the API response, and their own browser tab is also in the task:<id> room — without the dedupe check they'd see their own subtask/comment appear twice.

Restart the backend, open the same task in both windows, and try adding/completing a subtask and posting a comment from each side.

You can see into the image during sent comment and subtask, then able to sent 2 time
Thought for 48s

Good catch — that's a race condition, not literally clicking twice. Here's what's happening:

When you add a subtask, two things happen almost simultaneously:

    The HTTP POST request resolves and your .then() appends the subtask to state
    The server also emits subtask:created to the task:<id> room — which includes your own browser, since you joined that room too

The socket event and the HTTP response race each other. If the socket message arrives first (very likely on localhost — WebSocket delivery beats an HTTP round trip), it appends the subtask. Then the HTTP .then() fires right after and appends it again, with no check for whether it's already there. That's why only the creator's own window shows the duplicate (2 subtasks) while the other window — which only ever gets the single socket event — correctly shows 1.

The socket handler already guards against this (prev.some(...)); the HTTP .then() handlers don't. Fix is to add the same guard there.

TaskDetails.jsx — handleAddSubtask. Find:
js

    createSubtask(projectId, taskId, {
      title,
      assigned_to: newSubtaskAssignee ? Number(newSubtaskAssignee) : null,
    })
      .then((res) => {
        setSubtasks((prev) => [...prev, res.data.subtask]);
        setNewSubtaskTitle("");

Replace:
js

    createSubtask(projectId, taskId, {
      title,
      assigned_to: newSubtaskAssignee ? Number(newSubtaskAssignee) : null,
    })
      .then((res) => {
        setSubtasks((prev) =>
          prev.some((s) => s.id === res.data.subtask.id)
            ? prev
            : [...prev, res.data.subtask],
        );
        setNewSubtaskTitle("");

handleSendComment. Find:
js

    createComment(projectId, taskId, content)
      .then((res) => {
        setComments((prev) => [...prev, res.data.comment]);
        setCommentText("");
      })

Replace:
js

    createComment(projectId, taskId, content)
      .then((res) => {
        setComments((prev) =>
          prev.some((c) => c.id === res.data.comment.id)
            ? prev
            : [...prev, res.data.comment],
        );
        setCommentText("");
      })

Now whichever arrives first — the socket echo or the HTTP response — wins, and the second one is a no-op instead of a duplicate append. Delete the stray duplicate rows from your test data, restart the frontend, and try adding a subtask again — should show exactly 1 on both sides.
