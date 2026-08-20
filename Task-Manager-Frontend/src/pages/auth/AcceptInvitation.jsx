import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../../components/AuthLayout.jsx";
import FormField from "../../components/FormField.jsx";
import api from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    password: "",
    confirm_password: "",
  });
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

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/register/invitation", {
        token,
        first_name: form.first_name,
        last_name: form.last_name,
        password: form.password,
      });
      login(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message;

      if (status === 404) {
        setError("This invitation is invalid or is no longer available.");
      } else if (status === 410) {
        setError(
          "This invitation has expired. Please ask the organization administrator to send a new invitation.",
        );
      } else if (status === 409) {
        setError(
          message || "An account already exists for this email. Please log in and accept the invitation.",
        );
      } else {
        setError(message || "Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout
        title="Invalid Invitation"
        subtitle="This invitation link is missing or invalid."
      >
        <Link
          to="/login"
          className="block w-full rounded-lg bg-white text-black font-medium py-2.5 text-center hover:bg-white/90 transition-colors"
        >
          Go to Login
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Accept Invitation"
      subtitle="You've been invited to join an organization."
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
            placeholder="Doe"
          />
        </div>

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

        <FormField
          label="Confirm password"
          type="password"
          name="confirm_password"
          value={form.confirm_password}
          onChange={handleChange}
          placeholder="Re-enter your password"
          required
        />

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
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>
    </AuthLayout>
  );
}
