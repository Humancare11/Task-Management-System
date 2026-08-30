import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../components/auth/AuthShell.jsx";
import AuthField from "../components/auth/AuthField.jsx";
import PasswordStrength, {
  isPasswordValid,
} from "../components/auth/PasswordStrength.jsx";
import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapRegisterError(err) {
  const status = err.response?.status;
  const message = err.response?.data?.message;

  if (status === 409) {
    return "This email is already registered. Please sign in instead.";
  }
  if (status === 400) {
    return message || "Please check the details you entered and try again.";
  }
  if (!err.response) {
    return "Unable to reach the server. Check your connection and try again.";
  }
  return "Unable to create your account right now. Please try again.";
}

export default function Register() {
  const [form, setForm] = useState({
    company_name: "",
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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
    if (!form.company_name.trim()) errs.company_name = "Company name is required.";
    if (!form.first_name.trim()) errs.first_name = "First name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!EMAIL_RE.test(form.email.trim())) errs.email = "Enter a valid email address.";
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
    if (!acceptedTerms) {
      setError("Please accept the Terms and Conditions to continue.");
    }
    if (Object.keys(errs).length > 0 || !acceptedTerms) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        company_name: form.company_name.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      login(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(mapRegisterError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up your workspace and start managing your team's work."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-accentblue hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
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
            placeholder="Parker"
            autoComplete="family-name"
            error={fieldErrors.last_name}
          />
        </div>

        <AuthField
          label="Company name"
          name="company_name"
          value={form.company_name}
          onChange={handleChange}
          placeholder="Acme Inc"
          autoComplete="organization"
          error={fieldErrors.company_name}
          required
        />

        <AuthField
          label="Email address"
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="name@example.com"
          autoComplete="email"
          error={fieldErrors.email}
          required
        />

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

        <label className="mb-6 mt-1 flex items-center gap-2 text-sm text-txt-muted">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="h-4 w-4 rounded border-hair accent-accentblue"
          />
          <span>
            I accept the{" "}
            <a href="/terms" className="text-accentblue hover:underline">
              Terms and Conditions
            </a>
          </span>
        </label>

        {error && (
          <p
            className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accentblue py-2.5 text-sm font-medium text-white transition-colors hover:bg-accentblue-hover disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
