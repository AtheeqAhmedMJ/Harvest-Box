import { memo } from "react";
import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tt-label">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tt-row" style={{ color: p.color }}>
          <span className="chart-tt-name">{p.name}</span>
          <span className="chart-tt-val">
            {p.value}
            {unit ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * Reusable LineChart.
 * @param {object[]} data        - Array of data objects
 * @param {object[]} lines       - [{ key, name, color, unit? }]
 * @param {string}   xKey        - Key to use on X-axis (default: "day")
 * @param {string}   unit        - Unit suffix shown in tooltip
 * @param {number}   height      - Chart height in px (default: 180)
 */
function LineChart({ data = [], lines = [], xKey = "day", unit, height = 180 }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <ReLineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          {lines.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "var(--text-muted)" }}
            />
          )}
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.name ?? l.key}
              stroke={l.color ?? "var(--accent-green)"}
              strokeWidth={2.5}
              dot={{ r: 4, fill: "white", stroke: l.color ?? "var(--accent-green)", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </ReLineChart>
      </ResponsiveContainer>
      <style>{`
        .chart-tooltip {
          background: var(--bg-clay);
          border-radius: 10px;
          padding: 10px 14px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          font-size: 12px;
          min-width: 120px;
        }
        .chart-tt-label {
          font-weight: 700;
          color: var(--text-dark);
          margin-bottom: 6px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .chart-tt-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-top: 3px;
        }
        .chart-tt-val { font-weight: 600; }
      `}</style>
    </>
  );
}

export default memo(LineChart);
