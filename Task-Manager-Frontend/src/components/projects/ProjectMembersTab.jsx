import { useState } from "react";
import { Users, UserPlus, MoreHorizontal } from "lucide-react";
import EmptyState from "../common/EmptyState.jsx";
import ConfirmDialog from "../common/ConfirmDialog.jsx";
import Button from "../ui/Button.jsx";
import Avatar from "../ui/Avatar.jsx";
import Badge from "../ui/Badge.jsx";
import AddProjectMemberModal from "./AddProjectMemberModal.jsx";
import ChangeMemberRoleModal from "./ChangeMemberRoleModal.jsx";
import { removeProjectMember } from "../../api/projectMembers.js";
import { useToast } from "../../context/ToastContext.jsx";

export default function ProjectMembersTab({ projectId, members, onChanged, canManage }) {
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  function handleRemove() {
    setRemoving(true);
    removeProjectMember(projectId, removeTarget.user_id)
      .then(() => {
        toast.success("Member removed from project.");
        onChanged();
        setRemoveTarget(null);
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to remove member.");
      })
      .finally(() => setRemoving(false));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-ink">Project Members</h3>
        {canManage && (
          <Button icon={UserPlus} size="sm" onClick={() => setAddOpen(true)}>
            Add Member
          </Button>
        )}
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members on this project yet."
          description="Add organization members to give them access to this project."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Member</th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Email</th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Project Role</th>
                  {canManage && (
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          firstName={member.user?.first_name}
                          lastName={member.user?.last_name}
                          avatarUrl={member.user?.avatar_url}
                        />
                        <p className="font-medium text-ink">
                          {member.user?.first_name} {member.user?.last_name}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{member.user?.email}</td>
                    <td className="px-6 py-4">
                      <Badge tone="neutral">{member.role}</Badge>
                    </td>
                    {canManage && (
                      <td className="relative px-6 py-4 text-right">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {openMenuId === member.id && (
                          <div className="absolute right-6 top-12 z-10 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                            <button
                              onClick={() => {
                                setRoleTarget(member);
                                setOpenMenuId(null);
                              }}
                              className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-slate-50"
                            >
                              Change Role
                            </button>
                            <button
                              onClick={() => {
                                setRemoveTarget(member);
                                setOpenMenuId(null);
                              }}
                              className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddProjectMemberModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        projectId={projectId}
        existingMembers={members}
        onAdded={onChanged}
      />

      <ChangeMemberRoleModal
        open={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        projectId={projectId}
        member={roleTarget}
        onChanged={onChanged}
      />

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title="Remove Member"
        description={`Remove ${removeTarget?.user?.first_name} ${removeTarget?.user?.last_name} from this project?`}
        confirmLabel="Remove"
        loading={removing}
      />
    </div>
  );
}
