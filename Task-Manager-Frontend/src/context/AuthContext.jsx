import React, { createContext, useContext, useState } from "react";
import { disconnectSocket } from "../lib/socket.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  function login(token, userData) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    disconnectSocket();
    setUser(userData);
  }

  // Merge partial profile data into the current user (state + localStorage).
  // Used after a successful self-service profile update.
  function updateUser(partialUser) {
    setUser((prev) => {
      const next = { ...(prev ?? {}), ...partialUser };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    disconnectSocket();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
