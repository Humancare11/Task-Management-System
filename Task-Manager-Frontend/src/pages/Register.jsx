import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../components/auth/AuthShell.jsx";
import AuthField from "../components/auth/AuthField.jsx";
import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Register() {
  const [form, setForm] = useState({
    company_name: "",
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!acceptedTerms) {
      setError("Please accept the Terms and Conditions to continue.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/register", form);
      login(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.message || "Something went wrong. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your workspace"
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
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <AuthField
            label="First name"
            name="first_name"
            value={form.first_name}
            onChange={handleChange}
            placeholder="John"
            autoComplete="given-name"
            required
          />
          <AuthField
            label="Last name"
            name="last_name"
            value={form.last_name}
            onChange={handleChange}
            placeholder="Parker"
            autoComplete="family-name"
          />
        </div>

        <AuthField
          label="Company name"
          name="company_name"
          value={form.company_name}
          onChange={handleChange}
          placeholder="Acme Inc"
          autoComplete="organization"
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
          required
        />

        <AuthField
          label="Password"
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="8+ characters required"
          autoComplete="new-password"
          required
          minLength={8}
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
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accentblue py-2.5 text-sm font-medium text-white transition-colors hover:bg-accentblue-hover disabled:opacity-60"
        >
          {loading ? "Signing up…" : "Sign up"}
        </button>
      </form>
    </AuthShell>
  );
}
