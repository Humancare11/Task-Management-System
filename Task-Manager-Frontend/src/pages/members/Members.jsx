import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  MoreHorizontal,
  Calendar,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import Badge from "../../components/ui/Badge.jsx";
import InviteMemberModal from "../../components/invitations/InviteMemberModal.jsx";
import api from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { canManageInvitations } from "../../config/permissions.js";

const ROLE_OPTIONS = ["owner", "admin", "manager", "member", "client"];

const selectClass =
  "rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue";

function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatCard({ icon: Icon, tone, value, label }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-hair bg-surface-1 p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-txt-primary">{value}</p>
        <p className="text-xs text-txt-muted">{label}</p>
      </div>
    </div>
  );
}

export default function Members() {
  const { user } = useAuth();
  const canManage = canManageInvitations(user);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/organization/members");
      setMembers(res.data.members);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || "Failed to load organization members.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      if (!matchesRole) return false;
      if (!query) return true;
      const fullName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.toLowerCase();
      return fullName.includes(query) || member.email?.toLowerCase().includes(query);
    });
  }, [members, search, roleFilter]);

  // Only roles that exist on the current member payload are counted — no fabricated metrics.
  const stats = useMemo(
    () => ({
      total: members.length,
      owners: members.filter((m) => m.role === "owner").length,
      members: members.filter((m) => m.role === "member").length,
    }),
    [members],
  );

  const inviteAction = canManage ? (
    <Button icon={UserPlus} onClick={() => setInviteOpen(true)}>
      Invite Member
    </Button>
  ) : undefined;

  return (
    <AppLayout title="Members">
      <div className="space-y-6">
        <PageHeader
          title="Members"
          description="Manage your organization team."
          actions={inviteAction}
        />

        {loading && <Spinner label="Loading members..." />}

        {!loading && error && <ErrorState message={error} onRetry={fetchMembers} />}

        {!loading && !error && members.length === 0 && (
          <EmptyState
            icon={Users}
            title="No members yet"
            description="Invite teammates to start collaborating."
            action={inviteAction}
          />
        )}

        {!loading && !error && members.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                icon={Users}
                tone="bg-accentblue-soft text-accentblue"
                value={stats.total}
                label="Total Members"
              />
              <StatCard
                icon={ShieldCheck}
                tone="bg-purple-500/15 text-purple-600 dark:text-purple-300"
                value={stats.owners}
                label="Owners"
              />
              <StatCard
                icon={UserCircle2}
                tone="bg-sky-500/15 text-sky-600 dark:text-sky-300"
                value={stats.members}
                label="Members"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="sm:max-w-xs"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All roles</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role} className="capitalize">
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {filteredMembers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No members match your search."
                description="Try a different name, email, or role filter."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-hair bg-surface-1">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="border-b border-hair bg-surface-2">
                      <tr>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Member</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Email</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Role</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Joined</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-hair">
                      {filteredMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-surface-2">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar
                                firstName={member.first_name}
                                lastName={member.last_name}
                                avatarUrl={member.avatar_url}
                              />
                              <p className="font-medium text-txt-primary">
                                {member.first_name} {member.last_name}
                              </p>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-sm text-txt-muted">
                            {member.email}
                          </td>

                          <td className="px-6 py-4">
                            <Badge role={member.role} />
                          </td>

                          <td className="px-6 py-4 text-sm text-txt-muted">
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar size={13} className="text-txt-muted" />
                              {formatDate(member.joined_at)}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <button
                              disabled
                              title="Member management coming soon"
                              className="rounded-md p-1.5 text-txt-muted opacity-50 cursor-not-allowed"
                            >
                              <MoreHorizontal size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={fetchMembers}
      />
    </AppLayout>
  );
}
