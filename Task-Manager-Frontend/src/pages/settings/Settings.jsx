import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import SectionCard from "../../components/ui/SectionCard.jsx";
import Button from "../../components/ui/Button.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import {
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
  deleteMyAvatar,
} from "../../api/users.js";

const inputClass =
  "w-full rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-txt-muted";

const labelClass = "mb-1.5 block text-sm font-medium text-txt-primary";

const BIO_MAX = 1000;

const EDITABLE_FIELDS = ["first_name", "last_name", "job_title", "department", "bio"];

function toForm(profile) {
  return {
    first_name: profile?.first_name ?? "",
    last_name: profile?.last_name ?? "",
    job_title: profile?.job_title ?? "",
    department: profile?.department ?? "",
    bio: profile?.bio ?? "",
  };
}

export default function Settings() {
  const { updateUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(toForm(null));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await getMyProfile();
      setProfile(res.data.user);
      setForm(toForm(res.data.user));
    } catch (err) {
      setLoadError(
        err.response?.data?.message || "Could not load your profile.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty =
    !!profile &&
    EDITABLE_FIELDS.some(
      (f) => (form[f] ?? "").trim() !== (profile[f] ?? ""),
    );

  function handleChange(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  // Sync the authenticated user shape used across the app (topbar, sidebar,
  // avatars) with whatever the server just persisted.
  function syncAuthUser(user) {
    updateUser({
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_url: user.avatar_url,
      job_title: user.job_title,
      department: user.department,
      bio: user.bio,
    });
  }

  async function handleSave() {
    if (!form.first_name.trim()) {
      toast.error("First name is required.");
      return;
    }
    if (form.bio.length > BIO_MAX) {
      toast.error(`Bio must be ${BIO_MAX} characters or fewer.`);
      return;
    }

    setSaving(true);
    try {
      const res = await updateMyProfile({
        first_name: form.first_name,
        last_name: form.last_name,
        job_title: form.job_title,
        department: form.department,
        bio: form.bio,
      });
      setProfile(res.data.user);
      setForm(toForm(res.data.user));
      syncAuthUser(res.data.user);
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAvatarBusy(true);
    try {
      const res = await uploadMyAvatar(file);
      setProfile(res.data.user);
      syncAuthUser(res.data.user);
      toast.success("Photo updated.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload photo.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarBusy(true);
    try {
      const res = await deleteMyAvatar();
      setProfile(res.data.user);
      syncAuthUser(res.data.user);
      toast.success("Photo removed.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove photo.");
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <AppLayout title="Profile">
      <div className="space-y-6">
        <PageHeader
          title="Profile"
          description="Manage your personal information and photo."
          actions={
            !loading && !loadError ? (
              <Button onClick={handleSave} disabled={saving || !dirty}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            ) : null
          }
        />

        {loading && <Spinner label="Loading your profile..." />}

        {!loading && loadError && (
          <ErrorState message={loadError} onRetry={load} />
        )}

        {!loading && !loadError && profile && (
          <>
            {/* Profile photo */}
            <SectionCard title="Profile Photo">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar
                  firstName={profile.first_name}
                  lastName={profile.last_name}
                  avatarUrl={profile.avatar_url}
                  size="xl"
                />
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Upload}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarBusy}
                    >
                      {profile.avatar_url ? "Change photo" : "Upload photo"}
                    </Button>
                    {profile.avatar_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={handleAvatarRemove}
                        disabled={avatarBusy}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-txt-muted">
                    JPG, PNG, GIF or WebP, up to 10MB.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  className="hidden"
                  onChange={handleAvatarPick}
                />
              </div>
            </SectionCard>

            {/* Personal information */}
            <SectionCard title="Personal Information">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="first_name">
                    First name
                  </label>
                  <input
                    id="first_name"
                    type="text"
                    value={form.first_name}
                    onChange={handleChange("first_name")}
                    className={inputClass}
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="last_name">
                    Last name
                  </label>
                  <input
                    id="last_name"
                    type="text"
                    value={form.last_name}
                    onChange={handleChange("last_name")}
                    className={inputClass}
                    placeholder="Doe"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={profile.email}
                    readOnly
                    disabled
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-txt-muted">
                    Your email address can't be changed here.
                  </p>
                </div>
              </div>
            </SectionCard>

            {/* Work information */}
            <SectionCard title="Work Information">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="job_title">
                    Job title
                  </label>
                  <input
                    id="job_title"
                    type="text"
                    value={form.job_title}
                    onChange={handleChange("job_title")}
                    className={inputClass}
                    placeholder="Product Designer"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="department">
                    Department
                  </label>
                  <input
                    id="department"
                    type="text"
                    value={form.department}
                    onChange={handleChange("department")}
                    className={inputClass}
                    placeholder="Design"
                  />
                </div>
              </div>
            </SectionCard>

            {/* About */}
            <SectionCard title="About">
              <label className={labelClass} htmlFor="bio">
                Bio <span className="text-txt-muted">(optional)</span>
              </label>
              <textarea
                id="bio"
                value={form.bio}
                onChange={handleChange("bio")}
                rows={4}
                maxLength={BIO_MAX}
                className={inputClass}
                placeholder="A short introduction about yourself."
              />
              <p className="mt-1 text-right text-xs text-txt-muted">
                {form.bio.length}/{BIO_MAX}
              </p>
            </SectionCard>
          </>
        )}
      </div>
    </AppLayout>
  );
}
