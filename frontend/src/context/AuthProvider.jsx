import { useState, useEffect, useCallback } from "react";
import { AuthContext } from "./AuthContext";
import { apiFetch } from "../api/client";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔥 Restore session safely
  useEffect(() => {
    async function restore() {
      const token = localStorage.getItem("auth_token");

      // No token → skip
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiFetch("/user/summary");
        setUser(data);
      } catch (err) {
        // 🔥 HANDLE BOTH 401 + 403
        if (err.status === 401 || err.status === 403) {
          localStorage.removeItem("auth_token");
          setUser(null);
        } else {
          console.error("Restore failed:", err);
        }
      } finally {
        setLoading(false);
      }
    }

    restore();
  }, []);

  // 🔐 Login
  const login = useCallback((userData, token) => {
    localStorage.setItem("auth_token", token);
    setUser(userData);
  }, []);

  // 🚪 Logout
  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    setUser(null);
    window.location.replace("/login");
  }, []);

  // ⏳ App boot loader
  if (loading) {
    return (
      <div className="app-boot">
        <div className="app-boot-spinner" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}