import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { authApi } from "../../api/client";
import OtpInput from "../../components/OtpInput";
import Icon from "../../components/Icon/Icon";
import "./auth.css";

function validate(form, isLogin) {
  if (!form.email)              return "Email is required.";
  if (!/\S+@\S+\.\S+/.test(form.email)) return "Enter a valid email address.";
  if (!form.password)           return "Password is required.";
  if (form.password.length < 6) return "Password must be at least 6 characters.";
  if (!isLogin && !form.name.trim()) return "Full name is required.";
  return null;
}

// ── Toast system ──────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = "info", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  return { toasts, show };
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="auth-toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`auth-toast auth-toast-${t.type}`}>
          <span className="auth-toast-icon">
            {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default function Auth() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useAuth();

  const isLogin = location.pathname === "/login";

  const [form, setForm]       = useState({ name: "", email: "", password: "" });
  const [showPw, setShowPw]   = useState(false);
  const [otp, setOtp]         = useState("");
  const [step, setStep]       = useState("form"); // "form" | "otp"
  const [timer, setTimer]     = useState(30);
  const [loading, setLoading] = useState(false);

  const { toasts, show: showToast } = useToast();

  const notify = useCallback((text, type = "error") => {
    showToast(text, type);
  }, [showToast]);

  const getErrorMessage = (err, fallback = "Something went wrong.") => {
    return (
      err?.response?.data?.message ||
      err?.response?.data ||
      err?.message ||
      fallback
    );
  };

  // OTP countdown
  useEffect(() => {
    if (step === "otp" && timer > 0) {
      const t = setTimeout(() => setTimer(s => s - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [step, timer]);

  // Reset when switching login/register
  useEffect(() => {
    setForm({ name: "", email: "", password: "" });
    setOtp("");
    setStep("form");
  }, [isLogin]);

  function handleChange(e) {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validate(form, isLogin);
    if (err) return notify(err);

    try {
      setLoading(true);
      if (isLogin) {
        const data = await authApi.login(form.email, form.password);
        login(data.user, data.token);
        navigate("/", { replace: true });
      } else {
        await authApi.register(form.name, form.email, form.password);
        setStep("otp");
        setTimer(30);
        notify("OTP sent to your email.", "success");
      }
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(code) {
    if (code.length !== 6) return;
    try {
      setLoading(true);
      const data = await authApi.verifyOtp(form.email, code);
      login(data.user, data.token);
      notify("Account verified! Welcome 🌿", "success");
      setTimeout(() => navigate("/"), 800);
    } catch (err) {
      notify(getErrorMessage(err, "Invalid OTP."), "error");
      setOtp("");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      setLoading(true);
      await authApi.resendOtp(form.email);
      setTimer(30);
      setOtp("");
      notify("New OTP sent.", "success");
    } catch (err) {
      notify(getErrorMessage(err, "Failed to resend."), "error");
    } finally {
      setLoading(false);
    }
  }

  // Forgot Password Handler
  function handleForgotPassword() {
    notify(
      "Forgot password? Mail us at mediasphere680@gmail.com",
      "success"
    );
  }

  return (
    <div className="auth-page">
      {/* Left branding panel */}
      <div className="auth-left">
        <div className="auth-left-inner">
          <Icon size={96} />
          <h1>Harvest Box</h1>
          <p>Smart crop health monitoring for modern agriculture.</p>
          <div className="auth-features">
            {["AI-powered crop analysis", "Live weather intelligence", "Field grid tracking"].map(f => (
              <div key={f} className="auth-feature-pill">
                <span className="auth-feature-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="auth-right">
        <div className="auth-card clay-card">
          <div className="auth-card-header">
            <h2>
              {step === "otp" ? "Verify your email"
                : isLogin ? "Welcome back"
                : "Create account"}
            </h2>
            {step === "form" && (
              <p>
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  className="auth-switch-btn"
                  onClick={() => navigate(isLogin ? "/register" : "/login", { replace: true })}
                >
                  {isLogin ? "Register" : "Sign in"}
                </button>
              </p>
            )}
          </div>

          {/* ── Form step ── */}
          {step === "form" && (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {!isLogin && (
                <div className="auth-field">
                  <label>Full name</label>
                  <input
                    type="text" name="name"
                    placeholder="Full Name"
                    value={form.name} onChange={handleChange}
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="auth-field">
                <label>Email address</label>
                <input
                  type="email" name="email"
                  placeholder="Email"
                  value={form.email} onChange={handleChange}
                  autoComplete="email"
                />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <div className="auth-pw-wrap">
                  <input
                    type={showPw ? "text" : "password"} name="password"
                    placeholder="Min. 6 characters"
                    value={form.password} onChange={handleChange}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                  />
                  <button
                    type="button" className="auth-pw-toggle"
                    onClick={() => setShowPw(v => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw
                      ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {/* Forgot Password */}
              {isLogin && (
                <div className="auth-forgot">
                  <button
                    type="button"
                    className="auth-forgot-btn"
                    onClick={handleForgotPassword}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button type="submit" className="primary-btn auth-submit" disabled={loading}>
                {loading
                  ? <><span className="btn-spinner" />{isLogin ? "Signing in…" : "Creating account…"}</>
                  : isLogin ? "Sign in" : "Create account"
                }
              </button>
            </form>
          )}

          {/* ── OTP step ── */}
          {step === "otp" && (
            <div className="auth-otp">
              <p className="auth-otp-hint">
                Enter the 6-digit code sent to <strong>{form.email}</strong>
              </p>
              <OtpInput value={otp} onChange={setOtp} onComplete={handleVerifyOtp} />
              <button
                className="primary-btn auth-submit"
                onClick={() => handleVerifyOtp(otp)}
                disabled={otp.length !== 6 || loading}
              >
                {loading ? <><span className="btn-spinner" />Verifying…</> : "Verify OTP"}
              </button>
              <button
                className="auth-resend-btn"
                onClick={handleResend}
                disabled={timer > 0 || loading}
              >
                {timer > 0 ? `Resend code in ${timer}s` : "Resend code"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
