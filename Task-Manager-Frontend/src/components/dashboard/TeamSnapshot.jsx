import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import SectionCard from "../ui/SectionCard.jsx";
import EmptyState from "../common/EmptyState.jsx";
import Avatar from "../ui/Avatar.jsx";
import Badge from "../ui/Badge.jsx";
import api from "../../api/client.js";

const PREVIEW_COUNT = 5;

export default function TeamSnapshot() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchMembers() {
      try {
        const res = await api.get("/organization/members");
        if (active) setMembers(res.data.members);
      } catch (err) {
        console.error(err);
        if (active) {
          setError(err.response?.data?.message || "Failed to load team members.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchMembers();
    return () => {
      active = false;
    };
  }, []);

  const preview = members.slice(0, PREVIEW_COUNT);
  const remaining = members.length - preview.length;

  return (
    <SectionCard
      title="Team"
      actions={
        <Link
          to="/members"
          className="text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          View all
        </Link>
      }
    >
      {loading && (
        <p className="py-6 text-center text-sm text-slate-500">Loading team...</p>
      )}

      {!loading && error && (
        <p className="py-6 text-center text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && members.length === 0 && (
        <EmptyState
          icon={Users}
          title="No team members yet."
          description="Members you invite will appear here."
        />
      )}

      {!loading && !error && members.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {preview.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  firstName={member.first_name}
                  lastName={member.last_name}
                  avatarUrl={member.avatar_url}
                  size="sm"
                />
                <span className="truncate text-sm font-medium text-ink">
                  {member.first_name} {member.last_name}
                </span>
              </div>
              <Badge role={member.role} />
            </li>
          ))}
          {remaining > 0 && (
            <li className="pt-3 text-xs text-slate-400">
              +{remaining} more member{remaining === 1 ? "" : "s"}
            </li>
          )}
        </ul>
      )}
    </SectionCard>
  );
}
