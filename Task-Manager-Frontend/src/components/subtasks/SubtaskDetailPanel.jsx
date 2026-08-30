import { useEffect, useRef, useState } from "react";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";

import Avatar from "../ui/Avatar.jsx";
import ConfirmDialog from "../common/ConfirmDialog.jsx";
import { API_ORIGIN } from "../../api/client.js";
import {
  listComments,
  createComment,
  deleteComment,
} from "../../api/comments.js";
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
} from "../../api/attachments.js";
import { getSocket } from "../../lib/socket.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import {
  canEditSubtaskFully,
  canDeleteComment,
  canDeleteAttachment,
} from "../../config/permissions.js";

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getUserName(person) {
  if (!person) return "--";
  return (
    `${person.first_name || ""} ${person.last_name || ""}`.trim() ||
    person.name ||
    person.email ||
    "--"
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SubtaskDetailPanel({ projectId, taskId, subtask }) {
  const { user } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const canManage = canEditSubtaskFully(user);
  const canParticipate = user?.role !== "client";

  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);

  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState(null);
  const [commentDeleting, setCommentDeleting] = useState(false);

  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState(null);
  const [attachmentDeleting, setAttachmentDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listComments(projectId, taskId, subtask.id),
      listAttachments(projectId, taskId, subtask.id),
    ])
      .then(([commentsRes, attachmentsRes]) => {
        setComments(commentsRes.data.comments);
        setAttachments(attachmentsRes.data.attachments);
      })
      .catch((err) =>
        toast.error(
          err.response?.data?.message || "Failed to load subtask details.",
        ),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, taskId, subtask.id]);

  useEffect(() => {
    const socket = getSocket();

    function handleCommentCreated(comment) {
      if (comment.subtask_id !== subtask.id) return;
      setComments((prev) =>
        prev.some((c) => c.id === comment.id) ? prev : [...prev, comment],
      );
    }

    function handleCommentDeleted({ commentId, subtaskId }) {
      if (subtaskId !== subtask.id) return;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }

    socket.on("subtask-comment:created", handleCommentCreated);
    socket.on("subtask-comment:deleted", handleCommentDeleted);

    return () => {
      socket.off("subtask-comment:created", handleCommentCreated);
      socket.off("subtask-comment:deleted", handleCommentDeleted);
    };
  }, [subtask.id]);

  function handleSendComment() {
    const content = commentText.trim();
    if (!content) return;

    setCommentSending(true);
    createComment(projectId, taskId, content, subtask.id)
      .then((res) => {
        setComments((prev) =>
          prev.some((c) => c.id === res.data.comment.id)
            ? prev
            : [...prev, res.data.comment],
        );
        setCommentText("");
      })
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to send comment."),
      )
      .finally(() => setCommentSending(false));
  }

  function handleCommentKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  }

  function handleCommentDeleteConfirm() {
    if (!commentToDelete) return;
    setCommentDeleting(true);
    deleteComment(projectId, taskId, commentToDelete.id, subtask.id)
      .then(() => {
        setComments((prev) => prev.filter((c) => c.id !== commentToDelete.id));
        toast.success("Comment deleted.");
      })
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to delete comment."),
      )
      .finally(() => {
        setCommentDeleting(false);
        setCommentToDelete(null);
      });
  }

  function handleFileUpload(file) {
    if (!file) return;
    setAttachmentUploading(true);
    uploadAttachment(projectId, taskId, file, subtask.id)
      .then((res) => {
        setAttachments((prev) => [...prev, res.data.attachment]);
        toast.success("File uploaded.");
      })
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to upload file."),
      )
      .finally(() => setAttachmentUploading(false));
  }

  function handleFileInputChange(e) {
    handleFileUpload(e.target.files[0]);
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files[0]);
  }

  function handleAttachmentDeleteConfirm() {
    if (!attachmentToDelete) return;
    setAttachmentDeleting(true);
    deleteAttachment(projectId, taskId, attachmentToDelete.id, subtask.id)
      .then(() => {
        setAttachments((prev) =>
          prev.filter((a) => a.id !== attachmentToDelete.id),
        );
        toast.success("Attachment deleted.");
      })
      .catch((err) =>
        toast.error(
          err.response?.data?.message || "Failed to delete attachment.",
        ),
      )
      .finally(() => {
        setAttachmentDeleting(false);
        setAttachmentToDelete(null);
      });
  }

  if (loading) {
    return (
      <div className="py-4 text-center text-xs text-txt-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-hair bg-surface-1 px-3 py-3">
      {/* Attachments */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold text-txt-muted">
            Attachments
            {attachments.length > 0 && (
              <span className="ml-1 text-txt-muted">
                ({attachments.length})
              </span>
            )}
          </h4>
          {canParticipate && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={attachmentUploading}
              className="flex items-center gap-1 text-xs font-medium text-accentblue hover:text-accentblue disabled:opacity-40"
            >
              <Upload size={12} />
              {attachmentUploading ? "Uploading…" : "Upload"}
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        {attachments.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {attachments.map((file) => {
              const canDeleteFile = canDeleteAttachment(user, file);
              return (
                <div
                  key={file.id}
                  className="group flex items-center justify-between rounded-lg border border-hair bg-surface-1 px-2.5 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Paperclip size={14} className="shrink-0 text-txt-muted" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-txt-primary">
                        {file.file_name}
                      </p>
                      <p className="text-[11px] text-txt-muted">
                        {formatFileSize(file.file_size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <a
                      href={`${API_ORIGIN}${file.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md p-1 text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
                      title="Download"
                    >
                      <Download size={13} />
                    </a>
                    {canDeleteFile && (
                      <button
                        type="button"
                        onClick={() => setAttachmentToDelete(file)}
                        className="hidden rounded-md p-1 text-txt-muted hover:bg-red-500/10 hover:text-red-500 group-hover:block"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {canParticipate && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed px-3 py-3 text-center transition ${
              dragOver
                ? "border-accentblue bg-accentblue-soft"
                : "border-hair hover:border-hair"
            }`}
          >
            <p className="text-[11px] text-txt-muted">
              {attachmentUploading
                ? "Uploading…"
                : "Drop a file here or click to upload"}
            </p>
          </div>
        )}

        {!canParticipate && attachments.length === 0 && (
          <p className="text-xs text-txt-muted">No attachments</p>
        )}
      </div>

      {/* Comments */}
      <div className="border-t border-hair pt-3">
        <h4 className="mb-2 text-xs font-semibold text-txt-muted">
          Comments
          {comments.length > 0 && (
            <span className="ml-1 text-txt-muted">({comments.length})</span>
          )}
        </h4>

        <div className="mb-3 space-y-3">
          {comments.length === 0 && (
            <p className="text-xs text-txt-muted">No comments yet.</p>
          )}

          {comments.map((comment) => {
            const canDeleteThisComment = canDeleteComment(user, comment);

            return (
              <div key={comment.id} className="group flex gap-2">
                <div className="shrink-0">
                  <Avatar
                    firstName={comment.author?.first_name}
                    lastName={comment.author?.last_name}
                    avatarUrl={comment.author?.avatar_url}
                    size="sm"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-txt-primary">
                      {getUserName(comment.author)}
                    </span>
                    <span className="text-[11px] text-txt-muted">
                      {timeAgo(comment.created_at)}
                    </span>
                    {canDeleteThisComment && (
                      <button
                        type="button"
                        onClick={() => setCommentToDelete(comment)}
                        className="ml-auto hidden rounded p-1 text-txt-muted hover:bg-red-500/10 hover:text-red-500 group-hover:block"
                        title="Delete comment"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-txt-muted">
                    {comment.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {canParticipate && (
          <div className="flex gap-2">
            <div className="shrink-0">
              <Avatar
                firstName={user?.first_name}
                lastName={user?.last_name}
                avatarUrl={user?.avatar_url}
                size="sm"
              />
            </div>
            <div className="flex-1 rounded-lg border border-hair bg-surface-1 transition focus-within:border-accentblue focus-within:ring-1 focus-within:ring-accentblue/30">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={handleCommentKeyDown}
                placeholder="Write a comment…"
                disabled={commentSending}
                rows={2}
                className="w-full resize-none rounded-t-lg px-2.5 pt-2 text-xs text-txt-primary placeholder:text-txt-muted outline-none"
              />
              <div className="flex justify-end px-2.5 pb-1.5">
                <button
                  type="button"
                  onClick={handleSendComment}
                  disabled={commentSending || !commentText.trim()}
                  className="rounded-md bg-accentblue px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-accentblue-hover disabled:opacity-40"
                >
                  {commentSending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!commentToDelete}
        onClose={() => setCommentToDelete(null)}
        onConfirm={handleCommentDeleteConfirm}
        title="Delete Comment"
        description="Delete this comment? This cannot be undone."
        confirmLabel="Delete"
        loading={commentDeleting}
      />

      <ConfirmDialog
        open={!!attachmentToDelete}
        onClose={() => setAttachmentToDelete(null)}
        onConfirm={handleAttachmentDeleteConfirm}
        title="Delete Attachment"
        description={`Delete "${attachmentToDelete?.file_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={attachmentDeleting}
      />
    </div>
  );
}
