import { useEffect, useMemo, useState } from "react";
import { Users, UserPlus, MoreHorizontal } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import Badge from "../../components/ui/Badge.jsx";
import api from "../../api/client.js";

const ROLE_OPTIONS = ["owner", "admin", "manager", "member", "client"];

export default function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    async function fetchMembers() {
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
    }

    fetchMembers();
  }, []);

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

  return (
    <AppLayout title="Members">
      <div className="space-y-6">
        <PageHeader
          title="Members"
          description="Manage your organization team."
          actions={
            <Button icon={UserPlus} disabled title="Coming soon">
              Invite Member
            </Button>
          }
        />

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">Loading members...</p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {!loading && !error && members.length === 0 && (
          <EmptyState
            icon={Users}
            title="No members yet."
            description="Your organization's team members will be listed here."
          />
        )}

        {!loading && !error && members.length > 0 && (
          <>
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
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Member</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Email</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Role</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Joined</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar
                                firstName={member.first_name}
                                lastName={member.last_name}
                                avatarUrl={member.avatar_url}
                              />
                              <p className="font-medium text-ink">
                                {member.first_name} {member.last_name}
                              </p>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-600">
                            {member.email}
                          </td>

                          <td className="px-6 py-4">
                            <Badge role={member.role} />
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-600">
                            {new Date(member.joined_at).toLocaleDateString()}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <button
                              disabled
                              title="Member management coming soon"
                              className="rounded-md p-1.5 text-slate-300 cursor-not-allowed"
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
    </AppLayout>
  );
}
