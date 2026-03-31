import { memo } from "react";

/**
 * Horizontal confidence bar.
 * @param {number} value     0-100
 * @param {string} label
 * @param {string} color     CSS color or variable
 * @param {boolean} animate  Animate on mount
 */
function ConfidenceBar({ value = 0, label = "Confidence", color, animate = true }) {
  const resolvedColor =
    color ??
    (value >= 75 ? "var(--accent-green)" : value >= 45 ? "var(--accent-yellow)" : "var(--accent-red)");

  const tier = value >= 75 ? "High" : value >= 45 ? "Medium" : "Low";

  return (
    <div className="cb-wrap">
      <div className="cb-header">
        <span className="cb-label">{label}</span>
        <span className="cb-value" style={{ color: resolvedColor }}>
          {value}%
          <span className="cb-tier"> · {tier}</span>
        </span>
      </div>
      <div className="cb-track">
        <div
          className="cb-fill"
          style={{
            width: `${value}%`,
            background: resolvedColor,
            transition: animate ? "width 0.7s cubic-bezier(0.22,1,0.36,1)" : "none",
          }}
        />
      </div>
      <style>{`
        .cb-wrap { display: flex; flex-direction: column; gap: 6px; }
        .cb-header {
          display: flex; justify-content: space-between; align-items: baseline;
        }
        .cb-label {
          font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.07em;
          color: var(--text-muted);
        }
        .cb-value {
          font-size: 13px; font-weight: 700; color: var(--text-dark);
        }
        .cb-tier {
          font-size: 10px; font-weight: 500; opacity: 0.7;
        }
        .cb-track {
          height: 8px;
          background: rgba(0,0,0,0.07);
          border-radius: 99px;
          overflow: hidden;
        }
        .cb-fill {
          height: 100%; border-radius: 99px;
          min-width: 4px;
        }
      `}</style>
    </div>
  );
}

export default memo(ConfidenceBar);
