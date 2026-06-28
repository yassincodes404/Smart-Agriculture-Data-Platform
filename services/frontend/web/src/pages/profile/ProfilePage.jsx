/**
 * pages/profile/ProfilePage.jsx
 * -----------------------------
 * User profile with account info, statistics, and AI API key management.
 */

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getAiApiKeys,
  addAiApiKey,
  deleteAiApiKey,
  toggleAiApiKey,
} from "../../services/api";
import "../Pages.css";

export default function ProfilePage() {
  const { user } = useAuth();

  // AI API key state
  const [apiKeys, setApiKeys] = useState([]);
  const [newKey, setNewKey] = useState("");
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [addingKey, setAddingKey] = useState(false);
  const [keyError, setKeyError] = useState(null);
  const [keySuccess, setKeySuccess] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const res = await getAiApiKeys();
      setApiKeys(res.keys || []);
    } catch {
      // Not logged in or no keys yet — ignore
    }
  };

  const handleAddKey = async () => {
    if (!newKey.trim()) return;
    setAddingKey(true);
    setKeyError(null);
    setKeySuccess(null);
    try {
      await addAiApiKey(newKey.trim(), newKeyLabel.trim() || null);
      setKeySuccess("API key added successfully!");
      setNewKey("");
      setNewKeyLabel("");
      setShowAddForm(false);
      await loadKeys();
    } catch (err) {
      setKeyError(err.message || "Failed to add key.");
    } finally {
      setAddingKey(false);
    }
  };

  const handleDeleteKey = async (keyId) => {
    if (!window.confirm("Remove this API key?")) return;
    try {
      await deleteAiApiKey(keyId);
      await loadKeys();
    } catch (err) {
      setKeyError(err.message || "Failed to delete key.");
    }
  };

  const handleToggleKey = async (keyId, currentActive) => {
    try {
      await toggleAiApiKey(keyId, !currentActive);
      await loadKeys();
    } catch (err) {
      setKeyError(err.message || "Failed to toggle key.");
    }
  };

  const getInitials = () => {
    if (!user?.email) return "?";
    return user.email.charAt(0).toUpperCase();
  };

  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h1 className="page-header__title">My Profile</h1>
        <p className="page-header__subtitle">
          Manage your account settings and view your activity.
        </p>
      </div>

      <div className="profile-section">
        {/* Sidebar */}
        <div className="profile-sidebar anim-stagger" style={{ "--stagger-index": 0 }}>
          <div className="profile-avatar">{getInitials()}</div>
          <div className="profile-name">{user?.email?.split("@")[0] || "User"}</div>
          <div className="profile-email">{user?.email || "—"}</div>
          <span className="badge badge--healthy" style={{ marginBottom: "var(--space-md)" }}>
            {user?.role || "viewer"}
          </span>
          <div className="profile-stats">
            <div className="profile-stat">
              <div className="profile-stat__value">
                {apiKeys.filter((k) => k.is_active).length}
              </div>
              <div className="profile-stat__label">Active AI Keys</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat__value">{apiKeys.length}</div>
              <div className="profile-stat__label">Total Keys</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div>
          {/* Account Info */}
          <div className="section-header">
            <h2 className="section-header__title">Account Information</h2>
            <button className="btn btn--secondary btn--sm">Edit Profile</button>
          </div>
          <div className="card card--no-hover anim-stagger" style={{ "--stagger-index": 1, marginBottom: "var(--space-xl)" }}>
            <div className="grid-2" style={{ gap: "var(--space-lg)" }}>
              <div>
                <div className="text-overline" style={{ marginBottom: "var(--space-xs)" }}>Email</div>
                <div className="text-body">{user?.email || "—"}</div>
              </div>
              <div>
                <div className="text-overline" style={{ marginBottom: "var(--space-xs)" }}>Role</div>
                <div className="text-body" style={{ textTransform: "capitalize" }}>{user?.role || "viewer"}</div>
              </div>
              <div>
                <div className="text-overline" style={{ marginBottom: "var(--space-xs)" }}>Member Since</div>
                <div className="text-body">December 2025</div>
              </div>
              <div>
                <div className="text-overline" style={{ marginBottom: "var(--space-xs)" }}>Tracking Frequency</div>
                <div className="text-body">Weekly</div>
              </div>
            </div>
          </div>

          {/* ─── AI API Key Management ─────────────────────────────── */}
          <div className="section-header" style={{ marginTop: "var(--space-xl)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <h2 className="section-header__title">AI API Keys</h2>
              <span style={{
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
              }}>✨ Groq</span>
            </div>
            <button
              className="btn btn--primary btn--sm"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              + Add Key
            </button>
          </div>

          {/* Status messages */}
          {keyError && (
            <div style={{
              background: "var(--error-light)",
              border: "1px solid var(--error-border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-sm) var(--space-md)",
              marginBottom: "var(--space-md)",
              fontSize: 13,
              color: "var(--error)",
            }}>
              {keyError}
            </div>
          )}
          {keySuccess && (
            <div style={{
              background: "var(--success-light, #f0fdf4)",
              border: "1px solid var(--success-border, #86efac)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-sm) var(--space-md)",
              marginBottom: "var(--space-md)",
              fontSize: 13,
              color: "var(--green-600)",
            }}>
              {keySuccess}
            </div>
          )}

          {/* Add Key Form */}
          {showAddForm && (
            <div className="card card--no-hover anim-stagger" style={{ "--stagger-index": 2, marginBottom: "var(--space-md)", borderLeft: "3px solid #7c3aed" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                <div>
                  <label className="form-label">Key Label (optional)</label>
                  <input
                    className="form-control"
                    placeholder='e.g. "Primary Key", "Backup 1"'
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Groq API Key <span style={{ color: "var(--error)" }}>*</span></label>
                  <input
                    className="form-control"
                    placeholder="gsk_..."
                    type="password"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddKey()}
                  />
                  <span className="text-caption" style={{ marginTop: 4, display: "block" }}>
                    Get your key at{" "}
                    <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: "#f97316" }}>
                      console.groq.com
                    </a>
                    . Keys are stored securely and never fully displayed.
                  </span>
                </div>
                <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end" }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={handleAddKey}
                    disabled={addingKey || !newKey.trim()}
                  >
                    {addingKey ? "Saving…" : "Save Key"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Key list */}
          <div className="anim-stagger" style={{ "--stagger-index": 3, display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginBottom: "var(--space-xl)" }}>
            {apiKeys.length === 0 && !showAddForm && (
              <div className="card card--no-hover" style={{ textAlign: "center", padding: "var(--space-xl)", opacity: 0.7 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
                <div className="text-body-sm">No API keys yet.</div>
                <div className="text-caption">Add a Groq API key to enable AI crop analysis and chat.</div>
              </div>
            )}
            {apiKeys.map((key) => (
              <div
                key={key.key_id}
                className="card card--no-hover"
                style={{
                  padding: "var(--space-md)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  opacity: key.is_active ? 1 : 0.5,
                  borderLeft: key.quota_exceeded ? "3px solid var(--error)" : key.is_active ? "3px solid var(--green-500)" : "3px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                      {key.label || `Key #${key.key_id}`}
                    </div>
                    <div className="text-caption" style={{ fontFamily: "monospace", letterSpacing: "0.1em" }}>
                      ••••••{key.key_preview}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                    {key.quota_exceeded ? (
                      <span className="badge badge--critical" style={{ fontSize: 10 }}>Quota Exceeded</span>
                    ) : key.is_active ? (
                      <span className="badge badge--healthy" style={{ fontSize: 10 }}>Active</span>
                    ) : (
                      <span className="badge badge--neutral" style={{ fontSize: 10 }}>Disabled</span>
                    )}
                    <span className="badge badge--info" style={{ fontSize: 10, textTransform: "capitalize" }}>
                      {key.provider}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => handleToggleKey(key.key_id, key.is_active)}
                    title={key.is_active ? "Disable key" : "Enable key"}
                  >
                    {key.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    style={{ color: "var(--error)" }}
                    onClick={() => handleDeleteKey(key.key_id)}
                    title="Remove key"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* How It Works */}
          {apiKeys.length > 0 && (
            <div className="card card--no-hover" style={{ padding: "var(--space-md)", background: "var(--info-light)", border: "1px solid var(--info-border, #bfdbfe)" }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: "var(--info)" }}>
                ✨ How key rotation works
              </div>
              <div className="text-caption" style={{ lineHeight: 1.6 }}>
                Keys are tried in order (top to bottom). If a key hits its quota limit,
                the system automatically skips it and tries the next available key.
                Quota-exceeded keys are automatically re-enabled after 1 hour.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}