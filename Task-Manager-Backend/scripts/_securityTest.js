require("dotenv").config();
const jwt = require("jsonwebtoken");

const BASE = "http://localhost:5000/api";

function mint({ id, organization_id, role }) {
  return jwt.sign({ id, organization_id, role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

// Real org-8 resources (from live DB inspection)
const PROJECT_ID = 8;
const TASK_ID = 21; // project 8
const OTHER_TASK_ID = 22; // project 9
const SUBTASK_ID = 8; // belongs to task 21, assigned_to 16
const SUBTASK_OTHER_TASK = 9; // belongs to task 22, NOT task 21

const tokens = {
  owner: mint({ id: 15, organization_id: 8, role: "owner" }), // real owner
  admin: mint({ id: 13, organization_id: 8, role: "admin" }), // real user, synthetic org/role
  manager: mint({ id: 14, organization_id: 8, role: "manager" }), // real user, synthetic org/role
  memberAssignee: mint({ id: 16, organization_id: 8, role: "member" }), // real member, is subtask assignee
  memberOther: mint({ id: 11, organization_id: 8, role: "member" }), // real user, not assignee, synthetic org/role
  crossOrgMember: mint({ id: 7, organization_id: 4, role: "member" }), // real member of a DIFFERENT org
  crossOrgAdmin: mint({ id: 13, organization_id: 4, role: "admin" }), // real admin of org 4
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

async function req(method, path, token, body, isForm) {
  const headers = { Authorization: `Bearer ${token}` };
  let payload = body;
  if (body && !isForm) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data };
}

async function main() {
  console.log("=== A. Subtask tag update — role tests ===");

  {
    const r = await req("PUT", `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}`, tokens.owner, {
      tags: ["design", "backend"],
    });
    check("owner can set subtask tags", r.status === 200 && r.data.subtask.tags.some((t) => t.name === "design"), r);
  }

  {
    const r = await req("PUT", `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}`, tokens.admin, {
      tags: ["Bug", "bug", " BUG "],
    });
    const names = r.data?.subtask?.tags?.map((t) => t.name) ?? [];
    check("admin can set subtask tags", r.status === 200, r);
    check("tag normalization collapses case/whitespace dupes to one 'bug'", names.filter((n) => n === "bug").length === 1, names);
  }

  {
    const r = await req("PUT", `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}`, tokens.manager, {
      tags: ["urgent"],
    });
    check("manager can set subtask tags", r.status === 200, r);
  }

  {
    // member assignee: status-only update should succeed
    const r = await req("PUT", `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}`, tokens.memberAssignee, {
      status: "in_progress",
    });
    check("assignee member can update status only", r.status === 200, r);
  }

  {
    // member assignee: attempting to also set tags should be rejected
    const r = await req("PUT", `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}`, tokens.memberAssignee, {
      status: "todo",
      tags: ["hack"],
    });
    check("assignee member cannot set tags (status-only guard)", r.status === 403, r);
  }

  {
    // non-assignee member: no permission at all
    const r = await req("PUT", `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}`, tokens.memberOther, {
      status: "todo",
    });
    check("non-assignee member cannot update subtask", r.status === 403, r);
  }

  console.log("\n=== B. Subtask comments ===");

  let ownerCommentId, memberCommentId;

  {
    const r = await req("POST", `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}/comments`, tokens.owner, {
      content: "Owner comment on subtask",
    });
    check("owner can post subtask comment", r.status === 201 && r.data.comment.subtask_id === SUBTASK_ID, r);
    ownerCommentId = r.data?.comment?.id;
  }

  {
    const r = await req("POST", `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}/comments`, tokens.memberAssignee, {
      content: "Member comment on subtask",
    });
    check("member can post subtask comment", r.status === 201, r);
    memberCommentId = r.data?.comment?.id;
  }

  {
    const r = await req("GET", `/projects/${PROJECT_ID}/tasks/${TASK_ID}/comments`, tokens.owner);
    const leaked = r.data?.comments?.some((c) => c.subtask_id === SUBTASK_ID);
    check("task-level comment list does NOT include subtask comments", r.status === 200 && !leaked, r.data?.comments);
  }

  {
    const r = await req("GET", `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}/comments`, tokens.owner);
    const allScoped = r.data?.comments?.every((c) => c.subtask_id === SUBTASK_ID);
    check("subtask comment list only contains that subtask's comments", r.status === 200 && allScoped, r.data?.comments);
  }

  {
    // non-author, non-management member cannot delete owner's comment
    const r = await req(
      "DELETE",
      `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}/comments/${ownerCommentId}`,
      tokens.memberOther,
    );
    check("non-author member cannot delete others' subtask comment", r.status === 403, r);
  }

  {
    // author can delete own comment
    const r = await req(
      "DELETE",
      `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}/comments/${memberCommentId}`,
      tokens.memberAssignee,
    );
    check("author can delete own subtask comment", r.status === 200, r);
  }

  {
    // manager can delete anyone's comment
    const r = await req(
      "DELETE",
      `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}/comments/${ownerCommentId}`,
      tokens.manager,
    );
    check("manager can delete any subtask comment", r.status === 200, r);
  }

  console.log("\n=== C. Cross-org access denial ===");

  {
    const r = await req("GET", `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}/comments`, tokens.crossOrgMember);
    check("cross-org member denied (404) reading subtask comments", r.status === 404, r);
  }

  {
    const r = await req("PUT", `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}`, tokens.crossOrgAdmin, {
      tags: ["intruder"],
    });
    check("cross-org admin denied (404) updating subtask", r.status === 404, r);
  }

  console.log("\n=== D. ID tampering ===");

  {
    // subtask belongs to a DIFFERENT task within the same org
    const r = await req(
      "PUT",
      `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_OTHER_TASK}`,
      tokens.owner,
      { status: "completed" },
    );
    check("subtask/task mismatch (same org) → 404", r.status === 404, r);
  }

  {
    const r = await req(
      "GET",
      `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_OTHER_TASK}/comments`,
      tokens.owner,
    );
    check("comments under mismatched subtask/task → 404", r.status === 404, r);
  }

  {
    // body tries to inject organization_id / created_by-like fields — must be ignored
    const r = await req("POST", `/projects/${PROJECT_ID}/tasks/${TASK_ID}/subtasks/${SUBTASK_ID}/comments`, tokens.memberAssignee, {
      content: "spoof test",
      user_id: 999999,
      organization_id: 999999,
    });
    const ignored = r.data?.comment?.user_id === 16 && r.data?.comment?.organization_id === 8;
    check("spoofed user_id/organization_id in body ignored server-side", r.status === 201 && ignored, r.data?.comment);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
