require("dotenv").config();
const jwt = require("jsonwebtoken");

const BASE = "http://localhost:5000/api";

function mint({ id, organization_id, role }) {
  return jwt.sign({ id, organization_id, role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

const PROJECT_ID = 8;
const TASK_ID = 21;
const SUBTASK_ID = 8;

const tokens = {
  owner: mint({ id: 15, organization_id: 8, role: "owner" }),
  manager: mint({ id: 14, organization_id: 8, role: "manager" }),
  memberAssignee: mint({ id: 16, organization_id: 8, role: "member" }),
  memberOther: mint({ id: 11, organization_id: 8, role: "member" }),
};

let pass = 0;
let fail = 0;
function check(label, ok, extra) {
  if (ok) {
    pass++;
    console.log(`PASS  ${label}`);
  } else {
    fail++;
    console.log(`FAIL  ${label}  ${extra ? JSON.stringify(extra) : ""}`);
  }
}

async function uploadFile(path, token, filename, content, mimeType) {
  const form = new FormData();
  const blob = new Blob([content], { type: mimeType });
  form.append("file", blob, filename);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data };
}

async function req(method, path, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data };
}

async function main() {
  console.log("=== Subtask attachment upload/scoping/delete ===");

  const base = `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}/attachments`;

  let memberAttachmentId;

  {
    const r = await uploadFile(base, tokens.memberAssignee, "notes.txt", "hello world", "text/plain");
    check("member can upload valid file to subtask", r.status === 201, r);
    memberAttachmentId = r.data?.attachment?.id;
  }

  {
    const r = await uploadFile(base, tokens.owner, "malware.exe", "MZ...", "application/x-msdownload");
    check("disallowed mime type rejected", r.status !== 201, r);
  }

  {
    const bigContent = "a".repeat(11 * 1024 * 1024); // 11MB > 10MB limit
    const r = await uploadFile(base, tokens.owner, "big.txt", bigContent, "text/plain");
    check("file over 10MB rejected", r.status !== 201, r);
  }

  {
    const r = await req("GET", `/projects/${PROJECT_ID}/tasks/${TASK_ID}/attachments`, tokens.owner);
    const leaked = r.data?.attachments?.some((a) => a.id === memberAttachmentId);
    check("task-level attachment list does NOT include subtask attachment", r.status === 200 && !leaked, r.data?.attachments);
  }

  {
    const r = await req("GET", base, tokens.owner);
    const scoped = r.data?.attachments?.some((a) => a.id === memberAttachmentId);
    check("subtask attachment list includes the uploaded file", r.status === 200 && scoped, r.data?.attachments);
  }

  {
    const r = await req("DELETE", `${base}/${memberAttachmentId}`, tokens.memberOther);
    check("non-uploader, non-management member cannot delete attachment", r.status === 403, r);
  }

  {
    const r = await req("DELETE", `${base}/${memberAttachmentId}`, tokens.manager);
    check("manager can delete any subtask attachment", r.status === 200, r);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
