import { useEffect, useMemo, useState } from "react";
import { Search, Calendar, CircleDot, User } from "lucide-react";
import AppLayout from "../components/layout/AppLayout.jsx";
import StatCard from "../components/dashboard/StatCard.jsx";
import ProjectOverview from "../components/dashboard/ProjectOverview.jsx";
import RecentActivity from "../components/dashboard/RecentActivity.jsx";
import MyTasks from "../components/dashboard/MyTasks.jsx";
import TeamSnapshot from "../components/dashboard/TeamSnapshot.jsx";
import { listProjects } from "../api/projects.js";
import { listTasks, getMyTasks } from "../api/tasks.js";
import { listOrganizationMembers } from "../api/organizationMembers.js";
import { listNotifications } from "../api/notifications.js";

const filterChips = [
  { label: "Date", icon: Calendar },
  { label: "Status", icon: CircleDot },
  { label: "Owner", icon: User },
];

// A task counts as "open" until it reaches the terminal "completed" status
// (see the Task model status enum: todo | in_progress | review | completed).
const OPEN_TASK_STATUSES = ["todo", "in_progress", "review"];
// "Active" projects = anything not in a terminal state (Project enum: planned |
// active | on_hold | completed | archived).
const CLOSED_PROJECT_STATUSES = ["completed", "archived"];

export default function Dashboard() {
  // Each section owns its own request so one failing endpoint doesn't blank the
  // whole dashboard. All requests go through the shared authenticated api client.
  const [projectState, setProjectState] = useState({
    projects: [],
    tasks: [],
    loading: true,
    error: "",
  });
  const [myTaskState, setMyTaskState] = useState({
    tasks: [],
    loading: true,
    error: "",
  });
  const [memberState, setMemberState] = useState({
    members: [],
    loading: true,
    error: "",
  });
  const [activityState, setActivityState] = useState({
    items: [],
    loading: true,
    error: "",
  });

  useEffect(() => {
    let active = true;

    // Projects + their tasks — same endpoints the Projects and Tasks pages use.
    (async () => {
      try {
        const projectsRes = await listProjects();
        const projects = projectsRes.data.projects ?? [];
        const taskLists = await Promise.all(
          projects.map((project) =>
            listTasks(project.id)
              .then((res) =>
                (res.data.tasks ?? []).map((task) => ({ ...task, project })),
              )
              .catch(() => []),
          ),
        );
        if (active) {
          setProjectState({
            projects,
            tasks: taskLists.flat(),
            loading: false,
            error: "",
          });
        }
      } catch (err) {
        console.error("Dashboard: failed to load projects", err);
        if (active) {
          setProjectState({
            projects: [],
            tasks: [],
            loading: false,
            error: err.response?.data?.message || "Failed to load projects.",
          });
        }
      }
    })();

    (async () => {
      try {
        const res = await getMyTasks();
        if (active) {
          setMyTaskState({
            tasks: res.data.tasks ?? [],
            loading: false,
            error: "",
          });
        }
      } catch (err) {
        console.error("Dashboard: failed to load my tasks", err);
        if (active) {
          setMyTaskState({
            tasks: [],
            loading: false,
            error: err.response?.data?.message || "Failed to load your tasks.",
          });
        }
      }
    })();

    (async () => {
      try {
        const res = await listOrganizationMembers();
        if (active) {
          setMemberState({
            members: res.data.members ?? [],
            loading: false,
            error: "",
          });
        }
      } catch (err) {
        console.error("Dashboard: failed to load members", err);
        if (active) {
          setMemberState({
            members: [],
            loading: false,
            error: err.response?.data?.message || "Failed to load members.",
          });
        }
      }
    })();

    // "Recent activity" is backed by the notifications feed — the only
    // organization-wide event stream the current API exposes.
    (async () => {
      try {
        const res = await listNotifications();
        if (active) {
          setActivityState({
            items: res.data.notifications ?? [],
            loading: false,
            error: "",
          });
        }
      } catch (err) {
        console.error("Dashboard: failed to load activity", err);
        if (active) {
          setActivityState({
            items: [],
            loading: false,
            error: err.response?.data?.message || "Failed to load activity.",
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const activeProjects = projectState.projects.filter(
      (project) => !CLOSED_PROJECT_STATUSES.includes(project.status),
    ).length;
    const openTasks = projectState.tasks.filter((task) =>
      OPEN_TASK_STATUSES.includes(task.status),
    ).length;

    return [
      {
        label: "Active Projects",
        value: projectState.loading ? "—" : String(activeProjects),
        description: "Across your organization",
      },
      {
        label: "Open Tasks",
        value: projectState.loading ? "—" : String(openTasks),
        description: "Not yet completed",
      },
      {
        label: "My Tasks",
        value: myTaskState.loading ? "—" : String(myTaskState.tasks.length),
        description: "Assigned to you",
      },
      {
        label: "Team Members",
        value: memberState.loading ? "—" : String(memberState.members.length),
        description: "In your organization",
      },
    ];
  }, [projectState, myTaskState, memberState]);

  return (
    <AppLayout title="Dashboard">
      <div className="mx-auto flex flex-col gap-5">
        {/* KPI stats bar */}
        <div className="grid grid-cols-2 divide-x-[0.5px] divide-hair rounded-xl border-[0.5px] border-hair bg-surface-1 sm:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        {/* Command / filter bar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-lg border-[0.5px] border-hair bg-surface-1 px-3 py-2">
            <Search size={15} className="shrink-0 text-txt-muted" />
            <input
              type="text"
              disabled
              placeholder="Search projects, tasks, members…"
              className="w-full bg-transparent text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            {filterChips.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border-[0.5px] border-hair bg-surface-1 px-3 py-2 text-xs font-medium text-txt-primary transition-colors hover:bg-white/5"
              >
                <Icon size={13} className="text-txt-muted" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ProjectOverview
            projects={projectState.projects}
            tasks={projectState.tasks}
            members={memberState.members}
            loading={projectState.loading}
            error={projectState.error}
          />
          <RecentActivity
            items={activityState.items}
            loading={activityState.loading}
            error={activityState.error}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <MyTasks
            tasks={myTaskState.tasks}
            loading={myTaskState.loading}
            error={myTaskState.error}
          />
          <TeamSnapshot />
        </div>
      </div>
    </AppLayout>
  );
}
