/**
 * context/AuthContext.jsx
 * -----------------------
 * Global authentication state using React Context.
 *
 * Provides:
 * - user object (null if not logged in)
 * - login / register / logout functions
 * - loading state
 * - isAuthenticated boolean
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { loginUser, registerUser, logoutUser, getMe, getToken, clearToken } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // On mount: check if we have a stored token and load user
  useEffect(() => {
    const token = getToken();
    if (token) {
      getMe()
        .then((res) => setUser(res.data))
        .catch(() => {
          clearToken();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    const res = await loginUser({ email, password });
    // After login, fetch full user profile
    const meRes = await getMe();
    setUser(meRes.data);
    return res;
  }, []);

  const register = useCallback(async (email, password, role = "viewer") => {
    setError(null);
    const res = await registerUser({ email, password, role });
    return res;
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
