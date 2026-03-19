import { useState, useEffect } from "react";

export function useAuth() {
  // loading: true mientras se lee localStorage en el primer render
  const [loading, setLoading] = useState(true);
  const [user, setUser]       = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("itophub-user");
      if (raw) setUser(JSON.parse(raw));
    } catch {
      localStorage.removeItem("itophub-user");
      localStorage.removeItem("itophub-token");
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (userData, token) => {
    localStorage.setItem("itophub-user", JSON.stringify(userData));
    localStorage.setItem("itophub-token", token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("itophub-user");
    localStorage.removeItem("itophub-token");
    setUser(null);
  };

  return { user, login, logout, isAuthenticated: !!user, loading };
}