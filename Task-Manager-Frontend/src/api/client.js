import axios from "axios";

const api = axios.create({
  baseURL: "https://darkviolet-cobra-939760.hostingersite.com/api",
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