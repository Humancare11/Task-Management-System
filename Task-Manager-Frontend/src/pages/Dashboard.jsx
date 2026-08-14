import { FolderKanban, ListChecks, UserCheck, Users, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import AppLayout from "../components/layout/AppLayout.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Button from "../components/ui/Button.jsx";
import StatCard from "../components/dashboard/StatCard.jsx";
import QuickActions from "../components/dashboard/QuickActions.jsx";
import ProjectOverview from "../components/dashboard/ProjectOverview.jsx";
import MyTasks from "../components/dashboard/MyTasks.jsx";
import RecentActivity from "../components/dashboard/RecentActivity.jsx";
import TeamSnapshot from "../components/dashboard/TeamSnapshot.jsx";

// Stat values are placeholders — no dashboard-statistics API exists yet.
const stats = [
  {
    label: "Active Projects",
    icon: FolderKanban,
    value: "--",
    description: "Projects will appear here once you create them.",
  },
  {
    label: "Open Tasks",
    icon: ListChecks,
    value: "--",
    description: "Tasks across your workspace will appear here.",
  },
  {
    label: "My Tasks",
    icon: UserCheck,
    value: "--",
    description: "Tasks assigned to you will appear here.",
  },
  {
    label: "Team Members",
    icon: Users,
    value: "--",
    description: "See who's in your organization below.",
  },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        <PageHeader
          title={`Welcome back, ${user?.first_name ?? ""} \u{1F44B}`}
          description="Here's what's happening in your workspace."
          actions={
            <Button icon={Plus} disabled title="Coming soon">
              Create Project
            </Button>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        <QuickActions />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ProjectOverview />
          <MyTasks />
        </div>

        <RecentActivity />

        <TeamSnapshot />
      </div>
    </AppLayout>
  );
}
