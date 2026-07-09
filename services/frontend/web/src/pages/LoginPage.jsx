/**
 * pages/LoginPage.jsx
 * -------------------
 * Premium mobile-first login page.
 * On desktop: split-screen with hero left, form right.
 * On mobile (Capacitor): full-screen gradient with glassmorphic form card.
 */

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AuthPages.css";

import { Capacitor } from "@capacitor/core";

/* Detect Capacitor native environment properly */
const isNative = Capacitor.isNativePlatform();

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, googleSignIn } = useAuth();
  const navigate = useNavigate();

  // Initialize Google Sign In button — only for web (not Capacitor)
  useEffect(() => {
    if (isNative) return; // Skip Google GSI in native apps

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (window.google && clientId) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            handleGoogleSuccess(response.credential);
          }
        },
      });

      // Render the button
      const buttonDiv = document.getElementById("google-signin-button");
      if (buttonDiv) {
        window.google.accounts.id.renderButton(buttonDiv, {
          theme: "outline",
          size: "large",
          width: "100%",
          text: "signin_with",
        });
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await login(email, password);
      if (user?.role === "admin") {
        navigate("/logs");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      // Provide clearer error messages for mobile users
      const msg = err.message || "";
      if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")) {
        setError("Cannot connect to server. Please check your internet connection.");
      } else {
        setError(msg || "Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential) => {
    setError("");
    setLoading(true);
    try {
      const user = await googleSignIn(credential);
      if (user?.role === "admin") {
        navigate("/logs");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.message || "Google sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      {/* ---------- Left Hero Panel ---------- */}
      <div className="auth-hero">
        <div className="auth-hero__overlay" />
        <div className="auth-hero__content">
          <div className="auth-hero__logo">
            <div className="auth-hero__logo-icon" style={{ background: "transparent", padding: 0 }}>
              <img src="/logo.png" alt="AgriData Egypt Logo" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "12px" }} />
            </div>
            <span className="auth-hero__logo-text">AgriData Egypt</span>
          </div>

          <h1 className="auth-hero__title">
            Smart Agriculture<br />Data Platform
          </h1>
          <p className="auth-hero__subtitle">
            Empowering agricultural decisions across Egypt with real-time data analytics,
            climate insights, and AI-powered recommendations.
          </p>

          <div className="auth-hero__stats">
            <div className="auth-hero__stat">
              <span className="auth-hero__stat-value">27</span>
              <span className="auth-hero__stat-label">Governorates</span>
            </div>
            <div className="auth-hero__stat">
              <span className="auth-hero__stat-value">5yr</span>
              <span className="auth-hero__stat-label">Climate Data</span>
            </div>
            <div className="auth-hero__stat">
              <span className="auth-hero__stat-value">Real-time</span>
              <span className="auth-hero__stat-label">Analytics</span>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="auth-hero__dots" />
        <div className="auth-hero__circle auth-hero__circle--1" />
        <div className="auth-hero__circle auth-hero__circle--2" />
      </div>

      {/* ---------- Right Form Panel ---------- */}
      <div className="auth-form-panel">
        <div className="auth-form-container">
          {/* Mobile-only logo above form */}
          <div className="auth-mobile-logo">
            <img src="/logo.png" alt="AgriData Egypt" className="auth-mobile-logo__img" />
            <span className="auth-mobile-logo__text">AgriData Egypt</span>
          </div>

          <div className="auth-form-header">
            <h2 className="auth-form-title">Welcome back</h2>
            <p className="auth-form-subtitle">Sign in to access your dashboard</p>
          </div>

          {error && (
            <div className="auth-alert auth-alert--error" role="alert">
              <svg className="auth-alert__icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" id="login-form">
            <div className="input-group">
              <label htmlFor="login-email" className="input-label">Email address</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                  <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                </svg>
                <input
                  id="login-email"
                  type="email"
                  className="input-field"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="login-password" className="input-label">Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  minLength={8}
                />
                <button
                  type="button"
                  className="input-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.092 1.092a4 4 0 00-5.558-5.558z" clipRule="evenodd" /><path d="M10.748 13.93l2.523 2.523A9.987 9.987 0 0110 17a10.005 10.005 0 01-9.335-6.41 1.651 1.651 0 010-1.185A10.004 10.004 0 014.508 5.57l1.502 1.501a4 4 0 004.738 4.738z" /></svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--full"
              disabled={loading}
              id="login-submit"
            >
              {loading ? (
                <span className="btn__loading">
                  <span className="spinner" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>

            {/* Google Sign In — hidden on native Capacitor apps */}
            {!isNative && (
              <div style={{ marginTop: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <div style={{ flex: 1, height: "1px", background: "var(--gray-200)" }} />
                  <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>or</span>
                  <div style={{ flex: 1, height: "1px", background: "var(--gray-200)" }} />
                </div>
                <div id="google-signin-button" style={{ display: "flex", justifyContent: "center" }}></div>
                {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                  <p style={{ fontSize: "11px", color: "#f59e0b", textAlign: "center", marginTop: "4px" }}>
                    Set VITE_GOOGLE_CLIENT_ID in .env to enable Google Sign-In
                  </p>
                )}
              </div>
            )}
          </form>

          <div className="auth-form-footer">
            <p>
              Don't have an account?{" "}
              <Link to="/register" className="auth-link">Create one</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
