import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/client.js";

export default function OAuthSuccess() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      navigate("/login?error=missing_token");
      return;
    }

    async function completeLogin() {
      try {
        // Fetch the logged-in user's info using the token we just received.
        const res = await api.get("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        login(token, res.data.user);
        navigate("/dashboard");
      } catch (err) {
        navigate("/login?error=oauth_failed");
      }
    }

    completeLogin();
  }, [searchParams, login, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-black">Signing you in…</p>
    </div>
  );
}
