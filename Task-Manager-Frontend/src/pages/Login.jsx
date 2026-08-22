import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout.jsx";
import FormField from "../components/FormField.jsx";
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
    <AuthLayout
      title="Sign in"
      subtitle="Free access to our dashboard."
      footer={
        <>
          Don&apos;t have an account yet?{" "}
          <Link
            to="/register"
            className="text-white font-medium hover:underline"
          >
            Sign up here
          </Link>
        </>
      }
    >
      <button
        type="button"
        onClick={handleGoogleLogin}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-white text-black font-medium py-2.5 mb-6 hover:bg-white/90 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.03l2.99-2.33z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
          />
        </svg>
        Sign in with Google
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="h-px flex-1 bg-white/15" />
        <span className="text-xs text-white/50">OR</span>
        <div className="h-px flex-1 bg-white/15" />
      </div>

      <form onSubmit={handleSubmit}>
        <FormField
          label="Email address"
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="name@example.com"
          required
        />

        <div className="mb-2">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="text-sm text-white/80">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-sm text-white/80 hover:underline"
            >
              Forgot Password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="••••••••••••••"
            required
            className="w-full rounded-lg bg-white/10 border border-white/10 text-white placeholder-white/40 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/[0.15] transition-colors"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-white/70 mb-6 mt-3">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-white/30 bg-white/10 accent-white"
          />
          Remember me
        </label>

        {error && (
          <p className="text-sm text-red-400 mb-4" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-white text-black font-medium py-2.5 hover:bg-white/90 transition-colors disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
