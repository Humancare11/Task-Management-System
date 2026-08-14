import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  UserCheck,
  Users,
  Mail,
  Activity,
  Settings,
} from "lucide-react";

// NOTE: `roles` here controls sidebar VISIBILITY ONLY. It is not a security
// boundary — hiding a link does not prevent access. Real authorization must
// be enforced by the backend.
const ALL_ROLES = ["owner", "admin", "manager", "member", "client"];

export const navigationGroups = [
  {
    title: "MAIN",
    items: [
      { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
    ],
  },
  {
    title: "WORKSPACE",
    items: [
      { label: "Projects", path: "/projects", icon: FolderKanban, roles: ALL_ROLES },
      { label: "Tasks", path: "/tasks", icon: ListChecks, roles: ["owner", "admin", "manager"] },
      { label: "My Tasks", path: "/my-tasks", icon: UserCheck, roles: ALL_ROLES },
    ],
  },
  {
    title: "TEAM",
    items: [
      { label: "Members", path: "/members", icon: Users, roles: ["owner", "admin", "manager"] },
      { label: "Invitations", path: "/invitations", icon: Mail, roles: ["owner", "admin"] },
    ],
  },
  {
    title: "INSIGHTS",
    items: [
      { label: "Activity", path: "/activity", icon: Activity, roles: ["owner", "admin", "manager", "member"] },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Settings", path: "/settings", icon: Settings, roles: ["owner", "admin"] },
    ],
  },
];
