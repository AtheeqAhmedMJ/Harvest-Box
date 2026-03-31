import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { apiFetch } from "../../api/client";
import "./User.css";

function StatCard({ label, value, accent }) {
  return (
    <div className="up-stat-card clay-card">
      <div className="up-stat-val" style={accent ? { color: accent } : {}}>{value}</div>
      <div className="up-stat-label">{label}</div>
    </div>
  );
}

function InfoSkeleton() {
  return (
    <div className="up-skeleton">
      {[200, 100, 120].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 18, width: w, borderRadius: 6 }} />
      ))}
    </div>
  );
}

export default function User() {
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({ name: "", location: "" });
  const [saveMsg, setSaveMsg]   = useState("");

  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    apiFetch("/user/summary")
      .then(data => {
        setProfile(data);
        setForm({ name: data.name ?? "", location: data.location ?? "" });
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveMsg("");
    try {
      const updated = await apiFetch("/user/profile", {
        method: "PUT",
        body: JSON.stringify({ name: form.name, location: form.location }),
      });
      setProfile(p => ({ ...p, name: updated.name, location: updated.location }));
      setEditing(false);
      setSaveMsg("Profile updated successfully.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      setSaveMsg(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="up-root app-page">
      <div className="up-wrap">

        {/* Header */}
        <div className="up-page-header">
          <h1>My Profile</h1>
          <p>Manage your account information and view activity.</p>
        </div>

        {loading && <InfoSkeleton />}
        {error && (
          <div className="up-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {profile && (
          <>
            {/* Profile card */}
            <div className="clay-card up-profile-card">
              <div className="up-avatar">
                {(profile.name?.[0] ?? "U").toUpperCase()}
              </div>

              <div className="up-profile-info">
                {editing ? (
                  <div className="up-edit-form">
                    <div className="up-edit-field">
                      <label>Full name</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        className="up-input"
                        placeholder="Your name"
                      />
                    </div>
                    <div className="up-edit-field">
                      <label>Location</label>
                      <input
                        type="text"
                        value={form.location}
                        onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                        className="up-input"
                        placeholder="e.g. Mysuru, Karnataka"
                      />
                    </div>
                    <div className="up-edit-actions">
                      <button className="primary-btn up-save-btn" onClick={handleSave} disabled={saving}>
                        {saving ? <><span className="btn-spinner" /> Saving…</> : "Save changes"}
                      </button>
                      <button className="up-cancel-btn" onClick={() => { setEditing(false); setForm({ name: profile.name, location: profile.location }); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="up-name">{profile.name}</div>
                    <div className="up-email">{profile.email}</div>
                    <div className="up-location">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                      {profile.location || "Location not set"}
                    </div>
                  </>
                )}
              </div>

              {!editing && (
                <button className="up-edit-btn" onClick={() => setEditing(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
              )}
            </div>

            {saveMsg && (
              <div className={`up-save-msg ${saveMsg.includes("success") ? "success" : "error"}`}>
                {saveMsg}
              </div>
            )}

            {/* Activity stats */}
            <div className="up-section-label section-label">Activity Summary</div>
            <div className="up-stats">
              <StatCard label="Reports Generated" value={profile.reportsGenerated} />
              <StatCard label="Healthy Fields" value={profile.healthyFields} accent="var(--accent-green)" />
              <StatCard label="Flagged Warnings" value={profile.warnings} accent={profile.warnings > 0 ? "var(--accent-red)" : undefined} />
            </div>

            {/* Logout */}
            <button className="up-logout-btn" onClick={handleLogout}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}
