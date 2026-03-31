import { memo } from "react";
import { useUploadStore } from "../../store/useAppStore";

const STEPS = [
  { key: "uploading",   label: "Uploading",         icon: "⬆" },
  { key: "processing",  label: "AI Processing",      icon: "🔬" },
  { key: "generating",  label: "Generating Report",  icon: "📄" },
  { key: "done",        label: "Complete",           icon: "✓"  },
];

function UploadProgress() {
  const { status, progress, message, error } = useUploadStore();

  if (status === "idle") return null;

  const currentIdx = STEPS.findIndex((s) => s.key === status);
  const isError = status === "error";

  return (
    <div className={`up-prog-wrap${isError ? " is-error" : ""}`} role="status" aria-live="polite">
      {/* Step indicators */}
      <div className="up-prog-steps">
        {STEPS.map((step, i) => {
          const done    = i < currentIdx || status === "done";
          const active  = step.key === status;
          return (
            <div key={step.key} className={`up-prog-step${done ? " done" : active ? " active" : ""}`}>
              <div className="up-step-circle">
                {done ? (
                  <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
                    <path d="M3 8l4 4 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : active ? (
                  <span className="up-step-spinner" />
                ) : (
                  <span className="up-step-num">{i + 1}</span>
                )}
              </div>
              <span className="up-step-label">{step.label}</span>
              {i < STEPS.length - 1 && <div className={`up-step-line${done ? " done" : ""}`} />}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      {!isError && (
        <div className="up-prog-bar-track">
          <div
            className="up-prog-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Message */}
      <div className={`up-prog-msg${isError ? " error" : ""}`}>
        {isError ? (
          <>
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {error}
          </>
        ) : (
          message
        )}
      </div>

      <style>{`
        .up-prog-wrap {
          background: var(--bg-clay);
          border-radius: var(--r-lg);
          padding: 20px 24px;
          box-shadow: var(--shadow-card);
          display: flex; flex-direction: column; gap: 16px;
        }
        .up-prog-steps {
          display: flex; align-items: flex-start; gap: 0;
        }
        .up-prog-step {
          display: flex; align-items: center; gap: 8px;
          flex: 1;
          position: relative;
        }
        .up-step-circle {
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(0,0,0,0.07);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background 0.3s, box-shadow 0.3s;
        }
        .up-prog-step.done .up-step-circle {
          background: var(--accent-green);
          box-shadow: 0 0 0 3px rgba(58,125,68,0.2);
        }
        .up-prog-step.active .up-step-circle {
          background: var(--accent-blue);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.2);
        }
        .up-step-num { font-size: 11px; font-weight: 700; color: var(--text-muted); }
        .up-step-spinner {
          display: inline-block; width: 12px; height: 12px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        .up-step-label {
          font-size: 11px; font-weight: 600;
          color: var(--text-muted);
          white-space: nowrap;
          display: none;
        }
        .up-prog-step.active .up-step-label,
        .up-prog-step.done .up-step-label {
          display: block;
          color: var(--text-dark);
        }
        .up-step-line {
          flex: 1; height: 2px;
          background: rgba(0,0,0,0.08);
          margin: 0 4px;
          transition: background 0.4s;
        }
        .up-step-line.done { background: var(--accent-green); }

        .up-prog-bar-track {
          height: 6px; background: rgba(0,0,0,0.07); border-radius: 99px; overflow: hidden;
        }
        .up-prog-bar-fill {
          height: 100%; background: var(--accent-green); border-radius: 99px;
          transition: width 0.6s cubic-bezier(0.22,1,0.36,1);
        }
        .up-prog-msg {
          font-size: 12px; color: var(--text-muted);
          display: flex; align-items: center; gap: 6px;
        }
        .up-prog-msg.error { color: var(--accent-red); }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default memo(UploadProgress);
