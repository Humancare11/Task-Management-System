import { useRef, useState } from "react";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";
import ConfirmDialog from "../common/ConfirmDialog.jsx";
import { API_ORIGIN } from "../../api/client.js";
import formatFileSize from "../../utils/formatFileSize.js";

export default function AttachmentPanel({
  attachments,
  onUpload,
  onDelete,
  canUpload,
  canDelete,
  uploading,
  title = "Attachments",
}) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function handleFiles(file) {
    if (!file) return;
    onUpload(file);
  }

  function handleFileInputChange(e) {
    handleFiles(e.target.files[0]);
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files[0]);
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    Promise.resolve(onDelete(pendingDelete)).finally(() => {
      setDeleting(false);
      setPendingDelete(null);
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {title}
          {attachments.length > 0 && (
            <span className="ml-1.5 text-slate-400">({attachments.length})</span>
          )}
        </h3>
        {canUpload && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700 disabled:opacity-40"
          >
            <Upload size={13} />
            {uploading ? "Uploading…" : "Upload"}
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
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((file) => (
            <div
              key={file.id}
              className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-2 pr-1 transition hover:border-slate-300"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white">
                <Paperclip size={13} className="text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="max-w-[10rem] truncate text-xs font-medium text-slate-700">
                  {file.file_name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {formatFileSize(file.file_size)}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <a
                  href={`${API_ORIGIN}${file.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                  title="Download"
                >
                  <Download size={13} />
                </a>
                {canDelete?.(file) && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(file)}
                    className="hidden rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 group-hover:block"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
            dragOver ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <Upload
            size={18}
            className={`mx-auto mb-1 ${dragOver ? "text-sky-400" : "text-slate-300"}`}
          />
          <p className="text-xs text-slate-400">
            {uploading ? "Uploading…" : "Drop a file here or click to upload"}
          </p>
          <p className="mt-0.5 text-xs text-slate-300">
            PNG, JPG, PDF, DOC, XLS up to 10MB
          </p>
        </div>
      )}

      {!canUpload && attachments.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center">
          <Paperclip size={18} className="mx-auto mb-1 text-slate-300" />
          <p className="text-xs text-slate-400">No attachments</p>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete attachment"
        description={`Delete "${pendingDelete?.file_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
