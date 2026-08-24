import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "https://darkviolet-cobra-939760.hostingersite.com/api";

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach the JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;