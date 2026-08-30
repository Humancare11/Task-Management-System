import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../components/auth/AuthShell.jsx";
import AuthField from "../components/auth/AuthField.jsx";
import api, { API_BASE_URL } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
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
    setLoading(true);
    try {
      const res = await api.post("/auth/login", {
        ...form,
        remember_me: rememberMe,
      });
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

  function handleGoogleLogin() {
    window.location.href = `${API_BASE_URL}/auth/google`;
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back — sign in to your workspace."
      footer={
        <>
          Don&apos;t have an account yet?{" "}
          <Link to="/register" className="font-medium text-accentblue hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <button
        type="button"
        onClick={handleGoogleLogin}
        className="mb-5 flex w-full items-center justify-center gap-2 rounded-lg border border-hair bg-surface-2 py-2.5 text-sm font-medium text-txt-primary transition-colors hover:bg-surface-1"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.03l2.99-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
        </svg>
        Sign in with Google
      </button>

      <div className="mb-5 flex items-center gap-4">
        <div className="h-px flex-1 bg-hair" />
        <span className="text-xs text-txt-muted">OR</span>
        <div className="h-px flex-1 bg-hair" />
      </div>

      <form onSubmit={handleSubmit}>
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
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          labelRight={
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-txt-muted hover:text-accentblue"
            >
              Forgot password?
            </Link>
          }
        />

        <label className="mb-6 mt-1 flex items-center gap-2 text-sm text-txt-muted">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-hair accent-accentblue"
          />
          Remember me
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
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
