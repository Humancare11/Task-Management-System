import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
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
    <section className="flex flex-col rounded-xl border-[0.5px] border-hair bg-surface-1">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-txt-primary">Team</h2>
        <Link
          to="/members"
          className="text-[11px] font-medium text-accentblue hover:text-accentblue-icon"
        >
          View all
        </Link>
      </div>

      <div className="flex-1 border-t-[0.5px] border-hair px-4 py-2">
        {loading && (
          <p className="py-6 text-center text-sm text-txt-muted">Loading team...</p>
        )}

        {!loading && error && (
          <p className="py-6 text-center text-sm text-red-400">{error}</p>
        )}

        {!loading && !error && members.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-txt-muted">
              <Users size={18} />
            </span>
            <p className="text-sm text-txt-muted">No team members yet</p>
          </div>
        )}

        {!loading && !error && members.length > 0 && (
          <ul className="divide-y divide-hair">
            {preview.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  <Avatar
                    firstName={member.first_name}
                    lastName={member.last_name}
                    avatarUrl={member.avatar_url}
                    size="sm"
                  />
                  <span className="truncate text-sm font-medium text-txt-primary">
                    {member.first_name} {member.last_name}
                  </span>
                </div>
                <Badge role={member.role} />
              </li>
            ))}
            {remaining > 0 && (
              <li className="pt-2.5 text-xs text-txt-muted">
                +{remaining} more member{remaining === 1 ? "" : "s"}
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
