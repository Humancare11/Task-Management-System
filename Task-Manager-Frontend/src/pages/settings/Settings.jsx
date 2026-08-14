import { useAuth } from "../../context/AuthContext.jsx";
import AppLayout from "../../components/layout/AppLayout.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import SectionCard from "../../components/ui/SectionCard.jsx";

export default function Settings() {
  const { user } = useAuth();

  return (
    <AppLayout title="Settings">
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Manage your account and organization preferences."
        />
        <SectionCard title="Account">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-slate-500">Name</dt>
              <dd className="mt-0.5 text-sm text-ink">
                {user?.first_name} {user?.last_name}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Email</dt>
              <dd className="mt-0.5 text-sm text-ink">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Role</dt>
              <dd className="mt-0.5 text-sm capitalize text-ink">{user?.role}</dd>
            </div>
          </dl>
          <p className="mt-6 text-sm text-slate-500">
            Organization and preference settings are coming soon.
          </p>
        </SectionCard>
      </div>
    </AppLayout>
  );
}
