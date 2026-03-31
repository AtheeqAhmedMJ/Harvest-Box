import { memo } from "react";

/**
 * Semicircular risk gauge.
 * @param {number} value   0-100
 * @param {string} label
 * @param {string} sublabel
 */
function RiskGauge({ value = 0, label = "Risk", sublabel = "" }) {
  // Semicircle: 180° arc mapped to value 0→100
  const R = 52;
  const cx = 70;
  const cy = 66;
  // Arc from 180° to 0° (left to right)
  const angle = (value / 100) * 180; // degrees from left baseline
  const rad = (180 - angle) * (Math.PI / 180);
  const nx = cx + R * Math.cos(rad);
  const ny = cy - R * Math.sin(rad);

  // Track arc (full semicircle)
  const trackD = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  // Fill arc
  const fillD =
    value === 0
      ? ""
      : value >= 100
      ? `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`
      : `M ${cx - R} ${cy} A ${R} ${R} 0 ${angle > 180 ? 1 : 0} 1 ${nx.toFixed(2)} ${ny.toFixed(2)}`;

  const color =
    value < 30 ? "#3a7d44" : value < 60 ? "#f9a825" : "#e53935";
  const riskLabel =
    value < 30 ? "Low" : value < 60 ? "Moderate" : "High";

  return (
    <div className="rg-wrap">
      <svg viewBox="0 0 140 80" className="rg-svg" aria-label={`${label}: ${value}%`}>
        {/* Background gradient */}
        <defs>
          <linearGradient id="rg-track-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#3a7d44" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#f9a825" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#e53935" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Colored zone bands */}
        <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx} ${cy - R}`}
          fill="none" stroke="#3a7d44" strokeWidth="8" strokeOpacity="0.18" />
        <path d={`M ${cx} ${cy - R} A ${R} ${R} 0 0 1 ${cx + R * Math.cos(60 * Math.PI / 180)} ${cy - R * Math.sin(60 * Math.PI / 180)}`}
          fill="none" stroke="#f9a825" strokeWidth="8" strokeOpacity="0.18" />
        <path d={`M ${cx + R * Math.cos(60 * Math.PI / 180)} ${cy - R * Math.sin(60 * Math.PI / 180)} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          fill="none" stroke="#e53935" strokeWidth="8" strokeOpacity="0.18" />

        {/* Track */}
        <path d={trackD} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="8" strokeLinecap="round" />

        {/* Fill */}
        {fillD && (
          <path d={fillD} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s" }} />
        )}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={nx.toFixed(2)}
          y2={ny.toFixed(2)}
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}
        />
        <circle cx={cx} cy={cy} r="5" fill={color} />

        {/* Value label */}
        <text x={cx} y={cy - 20} textAnchor="middle" fontSize="15" fontWeight="700" fill={color}>
          {value}%
        </text>
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontWeight="600"
          textTransform="uppercase" letterSpacing="0.05em">
          {riskLabel} Risk
        </text>
      </svg>

      <div className="rg-label">{label}</div>
      {sublabel && <div className="rg-sub">{sublabel}</div>}

      <style>{`
        .rg-wrap {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
        }
        .rg-svg { width: 140px; height: auto; overflow: visible; }
        .rg-label {
          font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.07em;
          color: var(--text-muted);
        }
        .rg-sub {
          font-size: 10px; color: var(--text-faint);
        }
      `}</style>
    </div>
  );
}

export default memo(RiskGauge);
