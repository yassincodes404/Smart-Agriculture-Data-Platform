/**
 * pages/RegisterPage.jsx
 * ----------------------
 * Registration page — same split layout as LoginPage.
 */

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AuthPages.css";

/* Detect Capacitor native environment */
const isNative =
  typeof window !== "undefined" &&
  window.Capacitor &&
  window.Capacitor.isNativePlatform &&
  window.Capacitor.isNativePlatform();

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, googleSignIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await register(email, password, role);
      navigate("/login", { state: { registered: true } });
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential) => {
    setError("");
    setLoading(true);
    try {
      await googleSignIn(credential);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Google sign up failed.");
    } finally {
      setLoading(false);
    }
  };

  // Initialize Google Sign In — only for web
  useEffect(() => {
    if (isNative) return;
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

      const buttonDiv = document.getElementById("google-signup-button");
      if (buttonDiv) {
        window.google.accounts.id.renderButton(buttonDiv, {
          theme: "outline",
          size: "large",
          width: "100%",
          text: "signup_with",
        });
      }
    }
  }, []);

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
            Join the<br />Platform
          </h1>
          <p className="auth-hero__subtitle">
            Create your account and start exploring agricultural insights
            powered by real data from 27 Egyptian governorates.
          </p>

          <div className="auth-hero__features">
            <div className="auth-hero__feature">
              <svg viewBox="0 0 20 20" fill="currentColor" className="auth-hero__feature-icon">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
              <span>Climate data &amp; analytics dashboard</span>
            </div>
            <div className="auth-hero__feature">
              <svg viewBox="0 0 20 20" fill="currentColor" className="auth-hero__feature-icon">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
              <span>Crop production insights</span>
            </div>
            <div className="auth-hero__feature">
              <svg viewBox="0 0 20 20" fill="currentColor" className="auth-hero__feature-icon">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
              <span>Water efficiency monitoring</span>
            </div>
            <div className="auth-hero__feature">
              <svg viewBox="0 0 20 20" fill="currentColor" className="auth-hero__feature-icon">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
              <span>AI-powered recommendations</span>
            </div>
          </div>
        </div>

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
            <h2 className="auth-form-title">Create your account</h2>
            <p className="auth-form-subtitle">Fill in your details to get started</p>
          </div>

          {error && (
            <div className="auth-alert auth-alert--error" role="alert">
              <svg className="auth-alert__icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" id="register-form">
            <div className="input-group">
              <label htmlFor="register-email" className="input-label">Email address</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                  <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                </svg>
                <input
                  id="register-email"
                  type="email"
                  className="input-field"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="register-password" className="input-label">Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  className="input-field"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
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

            <div className="input-group">
              <label htmlFor="register-confirm" className="input-label">Confirm password</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
                <input
                  id="register-confirm"
                  type={showPassword ? "text" : "password"}
                  className="input-field"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="register-role" className="input-label">Role</label>
              <div className="input-wrapper input-wrapper--select">
                <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                </svg>
                <select
                  id="register-role"
                  className="input-field input-field--select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="viewer">Viewer</option>
                  <option value="analyst">Analyst</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--full"
              disabled={loading}
              id="register-submit"
            >
              {loading ? (
                <span className="btn__loading">
                  <span className="spinner" />
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>

            {/* Google Sign Up — hidden on native Capacitor apps */}
            {!isNative && (
              <div style={{ marginTop: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <div style={{ flex: 1, height: "1px", background: "var(--gray-200)" }} />
                  <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>or</span>
                  <div style={{ flex: 1, height: "1px", background: "var(--gray-200)" }} />
                </div>
                <div id="google-signup-button" style={{ display: "flex", justifyContent: "center" }}></div>
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
              Already have an account?{" "}
              <Link to="/login" className="auth-link">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
