import { createContext, useMemo } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@routes";
import { useTheme } from "@hooks/useTheme";
import { useAuth } from "@hooks/useAuth";
import { ToastProvider } from "@ui";
import { ErrorBoundary } from "@ui";

export const ThemeContext = createContext({ theme: "dark", toggle: () => {} });
export const AuthContext  = createContext({
  user: null,
  expiresAt: null,
  warningSeconds: 30,
  login: () => {},
  logout: () => {},
  refreshSession: () => {},
  keepSessionAlive: () => {},
  requestRuntimeTokenRevalidation: () => {},
  isAuthenticated: false,
  loading: true,
});

export default function App() {
  const { theme, toggle }                          = useTheme();
  const {
    user,
    expiresAt,
    warningSeconds,
    login,
    logout,
    refreshSession,
    keepSessionAlive,
    requestRuntimeTokenRevalidation,
    isAuthenticated,
    loading,
  } = useAuth();

  const themeValue = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  const authValue  = useMemo(
    () => ({
      user,
      expiresAt,
      warningSeconds,
      login,
      logout,
      refreshSession,
      keepSessionAlive,
      requestRuntimeTokenRevalidation,
      isAuthenticated,
      loading,
    }),
    [
      user,
      expiresAt,
      warningSeconds,
      login,
      logout,
      refreshSession,
      keepSessionAlive,
      requestRuntimeTokenRevalidation,
      isAuthenticated,
      loading,
    ]
  );

  return (
    <ErrorBoundary>
      <ThemeContext.Provider value={themeValue}>
        <AuthContext.Provider value={authValue}>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </AuthContext.Provider>
      </ThemeContext.Provider>
    </ErrorBoundary>
  );
}
