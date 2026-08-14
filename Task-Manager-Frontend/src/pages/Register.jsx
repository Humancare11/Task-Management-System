import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout.jsx";
import FormField from "../components/FormField.jsx";
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
    <AuthLayout
      title="Create your account"
      subtitle="Free access to our dashboard."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-white font-medium hover:underline">
            Sign in here
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="First name"
            name="first_name"
            value={form.first_name}
            onChange={handleChange}
            placeholder="John"
            required
          />
          <FormField
            label="Last name"
            name="last_name"
            value={form.last_name}
            onChange={handleChange}
            placeholder="Parker"
          />
        </div>

        <FormField
          label="Company name"
          name="company_name"
          value={form.company_name}
          onChange={handleChange}
          placeholder="Acme Inc"
          required
        />

        <FormField
          label="Email address"
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="name@example.com"
          required
        />

        <FormField
          label="Password"
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="8+ characters required"
          required
          minLength={8}
        />

        <label className="flex items-center gap-2 text-sm text-white/70 mb-6 mt-1">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="w-4 h-4 rounded border-white/30 bg-white/10 accent-white"
          />
          I accept the{" "}
          <a href="/terms" className="text-white hover:underline">
            Terms and Conditions
          </a>
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
          {loading ? "Signing up…" : "Sign up"}
        </button>
      </form>
    </AuthLayout>
  );
}
