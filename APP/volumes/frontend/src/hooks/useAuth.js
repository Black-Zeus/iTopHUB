import { useState, useEffect } from "react";
import {
  authenticateUser,
  clearStoredSession,
  getStoredSession,
  persistSession,
} from "@services/auth-session-service";

export function useAuth() {
  // loading: true mientras se lee localStorage en el primer render
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const session = getStoredSession();
    if (session?.user) setUser(session.user);
    setLoading(false);
  }, []);

  const login = async (credentials) => {
    const session = await authenticateUser(credentials);
    persistSession(session);
    setUser(session.user);
    return session;
  };

  const logout = () => {
    clearStoredSession();
    setUser(null);
  };

  return { user, login, logout, isAuthenticated: !!user, loading };
}
