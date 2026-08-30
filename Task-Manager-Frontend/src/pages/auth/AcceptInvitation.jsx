import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthShell from "../../components/auth/AuthShell.jsx";
import AuthField from "../../components/auth/AuthField.jsx";
import InvitationCard from "../../components/auth/InvitationCard.jsx";
import PasswordStrength, {
  isPasswordValid,
} from "../../components/auth/PasswordStrength.jsx";
import api from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";

function mapInvitationError(err) {
  const status = err.response?.status;
  const message = err.response?.data?.message;

  if (status === 404) {
    return "This invitation is invalid or is no longer available.";
  }
  if (status === 410) {
    return "This invitation has expired. Please ask an organization administrator to send a new one.";
  }
  if (status === 409) {
    return (
      message ||
      "An account already exists for this email. Please sign in and accept the invitation."
    );
  }
  if (status === 400) {
    return message || "Please check the details you entered and try again.";
  }
  if (!err.response) {
    return "Unable to reach the server. Check your connection and try again.";
  }
  return "Unable to create your account right now. Please try again.";
}

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  // Optional, non-authoritative context if the invitation link carries it.
  // The backend re-validates the token regardless of what is shown here.
  const inviteOrg = searchParams.get("org") || searchParams.get("organization");
  const inviteEmail = searchParams.get("email");
  const inviteRole = searchParams.get("role");
  const invitedBy = searchParams.get("invited_by") || searchParams.get("inviter");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    password: "",
    confirm_password: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function validate() {
    const errs = {};
    if (!form.first_name.trim()) errs.first_name = "First name is required.";
    if (!isPasswordValid(form.password))
      errs.password = "Password must be at least 8 characters.";
    if (form.confirm_password !== form.password)
      errs.confirm_password = "Passwords do not match.";
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/register/invitation", {
        token,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        password: form.password,
      });
      login(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(mapInvitationError(err));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="Invalid invitation"
        subtitle="This invitation link is missing or invalid. Please use the link from your invitation email."
      >
        <Link
          to="/login"
          className="block w-full rounded-lg bg-accentblue py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-accentblue-hover"
        >
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Complete your account"
      subtitle="Set up your account to join your team."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-accentblue hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <InvitationCard
        organization={inviteOrg}
        email={inviteEmail}
        role={inviteRole}
        invitedBy={invitedBy}
      />

      <form onSubmit={handleSubmit} noValidate>
        {inviteEmail && (
          <AuthField
            label="Email address"
            type="email"
            name="invited_email"
            value={inviteEmail}
            autoComplete="email"
            readOnly
            className="opacity-90"
          />
        )}

        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <AuthField
            label="First name"
            name="first_name"
            value={form.first_name}
            onChange={handleChange}
            placeholder="John"
            autoComplete="given-name"
            error={fieldErrors.first_name}
            required
          />
          <AuthField
            label="Last name"
            name="last_name"
            value={form.last_name}
            onChange={handleChange}
            placeholder="Doe"
            autoComplete="family-name"
            error={fieldErrors.last_name}
          />
        </div>

        <AuthField
          label="Password"
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="8+ characters"
          autoComplete="new-password"
          error={fieldErrors.password}
          required
        />
        <PasswordStrength password={form.password} />

        <AuthField
          label="Confirm password"
          type="password"
          name="confirm_password"
          value={form.confirm_password}
          onChange={handleChange}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          error={fieldErrors.confirm_password}
          required
        />

        {error && (
          <p
            className="mb-4 mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-lg bg-accentblue py-2.5 text-sm font-medium text-white transition-colors hover:bg-accentblue-hover disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
