import {
  useEffect, useState, useMemo, 
  memo, useCallback, useRef,
} from "react";
import Icon from "../../components/Icon/Icon";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { apiFetch } from "../../api/client";
import { useReportsStore } from "../../store/useAppStore";
import RiskGauge from "../../components/Charts/RiskGauge";
import ConfidenceBar from "../../components/Charts/ConfidenceBar";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import "./reports.css";

// ── Constants ─────────────────────────────────────────────────────────────────
const DISEASE_COLORS = {
  Healthy:       "#3a7d44",
  Black_Rot:     "#e53935",
  Downy_Mildew:  "#2563eb",
  Powdery_Mildew:"#f9a825",
  UNKNOWN:       "#9aaa9a",
};

const DISEASE_LABELS = {
  Healthy:       "Healthy",
  Black_Rot:     "Black Rot",
  Downy_Mildew:  "Downy Mildew",
  Powdery_Mildew:"Powdery Mildew",
};

// ── Toast system ──────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = "info", duration = 2000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  return { toasts, show };
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="rp-toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`rp-toast rp-toast-${t.type}`}>
          <span className="rp-toast-icon">
            {t.type === "info"    ? "ℹ️" :
             t.type === "warn"    ? "⚠️" :
             t.type === "success" ? "✅" : "🔔"}
          </span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(iso) {
  if (!iso) return "Unknown date";
  return new Date(iso).toLocaleString("en-IN", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtShort(iso) {
  if (!iso) return "?";
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function severityColor(s) {
  if (!s) return "var(--text-muted)";
  const n = typeof s === "string" ? { none: 0, medium: 0.5, high: 1 }[s.toLowerCase()] ?? 0 : s;
  if (n >= 0.8) return "var(--accent-red)";
  if (n >= 0.4) return "var(--accent-yellow)";
  return "var(--accent-green)";
}

function diseaseLabel(h) {
  if (!h) return "Unknown";
  return DISEASE_LABELS[h] ?? h.replace(/_/g, " ");
}

// ── Sub-components ────────────────────────────────────────────────────────────
const HealthBadge = memo(({ health }) => {
  if (!health) return <span className="rp-badge rp-badge-default">ANALYZED</span>;
  const h   = health.toLowerCase();
  const cls = h.includes("healthy") ? "healthy"
    : h.includes("mildew") || h.includes("rot") ? "diseased"
    : "default";
  return <span className={`rp-badge rp-badge-${cls}`}>{diseaseLabel(health)}</span>;
});

const WeatherRiskBadge = memo(({ risk }) => {
  if (!risk || risk === "Unknown") return null;
  const cls = risk === "High" ? "risk-high" : risk === "Moderate" ? "risk-mid" : "risk-low";
  return <span className={`rp-weather-badge rp-weather-${cls}`}>🌡 {risk} Disease Risk</span>;
});

function EmptyState() {
  return (
    <div className="rp-empty">
      <div className="rp-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
          <path d="M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5"/>
        </svg>
      </div>
      <h3>No analysis reports yet</h3>
      <p>Go to <strong>Field Setup</strong>, photograph one grape leaf, and upload it. Your first AI diagnosis report will appear here.</p>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="rp-skeleton-list">
      {[1,2,3].map(i => <div key={i} className="skeleton rp-sk-item" />)}
    </div>
  );
}

function RetryBanner({ message, onRetry }) {
  return (
    <div className="rp-error">
      <span>{message}</span>
      <button className="rp-retry-btn" onClick={onRetry}>Retry</button>
    </div>
  );
}

// ── Analytics summary cards ───────────────────────────────────────────────────
function AnalyticsSummary({ reports }) {
  const stats = useMemo(() => {
    const total     = reports.length;
    const healthy   = reports.filter(r => r.health === "Healthy").length;
    const diseased  = total - healthy;
    const avgConf   = total
      ? Math.round(reports.reduce((s, r) => s + (r.confidence ?? 0), 0) / total)
      : 0;
    const highRisk  = reports.filter(r => r.weatherRisk === "High").length;

    const diseaseDist = {};
    for (const r of reports) {
      const key = r.health || "UNKNOWN";
      diseaseDist[key] = (diseaseDist[key] || 0) + 1;
    }

    return { total, healthy, diseased, avgConf, highRisk, diseaseDist };
  }, [reports]);

  return (
    <div className="rp-analytics-row">
      <div className="rp-stat-card clay-card">
        <div className="rp-stat-icon" style={{ background: "rgba(58,125,68,0.1)", color: "var(--accent-green)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>
          </svg>
        </div>
        <div className="rp-stat-val">{stats.total}</div>
        <div className="rp-stat-label">Total Scans</div>
      </div>

      <div className="rp-stat-card clay-card">
        <div className="rp-stat-icon" style={{ background: "rgba(58,125,68,0.1)", color: "var(--accent-green)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
            <path d="M8 12l2 2 4-4"/>
          </svg>
        </div>
        <div className="rp-stat-val" style={{ color: "var(--accent-green)" }}>{stats.healthy}</div>
        <div className="rp-stat-label">Healthy</div>
        <div className="rp-stat-pct">{stats.total ? Math.round(stats.healthy / stats.total * 100) : 0}%</div>
      </div>

      <div className="rp-stat-card clay-card">
        <div className="rp-stat-icon" style={{ background: "rgba(229,57,53,0.1)", color: "var(--accent-red)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div className="rp-stat-val" style={{ color: "var(--accent-red)" }}>{stats.diseased}</div>
        <div className="rp-stat-label">Diseased</div>
        <div className="rp-stat-pct">{stats.total ? Math.round(stats.diseased / stats.total * 100) : 0}%</div>
      </div>

      <div className="rp-stat-card clay-card">
        <div className="rp-stat-icon" style={{ background: "rgba(37,99,235,0.1)", color: "var(--accent-blue)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <div className="rp-stat-val" style={{ color: "var(--accent-blue)" }}>{stats.avgConf}%</div>
        <div className="rp-stat-label">Avg Confidence</div>
      </div>

      <div className="rp-stat-card clay-card">
        <div className="rp-stat-icon" style={{ background: "rgba(249,168,37,0.1)", color: "var(--accent-yellow)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div className="rp-stat-val" style={{ color: "var(--accent-yellow)" }}>{stats.highRisk}</div>
        <div className="rp-stat-label">High Weather Risk</div>
      </div>
    </div>
  );
}

// ── Plant ratings graph ───────────────────────────────────────────────────────
const CustomBar = memo((props) => {
  const { x, y, width, height, fill } = props;
  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />;
});

const PlantCustomTooltip = memo(({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rp-chart-tooltip">
      <div className="rp-ctt-grid">{d?.name}</div>
      <div className="rp-ctt-date">{d?.date}</div>
      <div className="rp-ctt-disease">{d?.disease}</div>
      <div className="rp-ctt-row">
        <span>Confidence</span><strong style={{ color: "var(--accent-blue)" }}>{d?.confidence}%</strong>
      </div>
      <div className="rp-ctt-row">
        <span>Severity</span><strong style={{ color: d?.fill }}>{d?.severity}%</strong>
      </div>
    </div>
  );
});

function PlantRatingsGraph({ reports }) {
  const data = useMemo(() =>
    [...reports].reverse().slice(0, 20).map((r) => ({
      name:       `(${r.rowIndex},${r.colIndex})`,
      confidence: Math.round(r.confidence ?? 0),
      severity:   Math.round((r.severity ?? 0) * 100),
      disease:    diseaseLabel(r.health),
      date:       fmtShort(r.analyzedAt),
      fill:       DISEASE_COLORS[r.health] ?? DISEASE_COLORS.UNKNOWN,
    })),
  [reports]);

  return (
    <div className="rp-card rp-ratings-graph">
      <div className="rp-card-header">
        <div>
          <div className="rp-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Plant Confidence Ratings
          </div>
          <div className="rp-card-sub">AI confidence score per scanned grid position</div>
        </div>
        <div className="rp-model-badge">🍇 Grape Model Only</div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} unit="%" />
          <Tooltip content={<PlantCustomTooltip />} />
          <Bar dataKey="confidence" shape={<CustomBar />}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="rp-legend">
        {Object.entries(DISEASE_COLORS).filter(([k]) => k !== "UNKNOWN").map(([k, color]) => (
          <div key={k} className="rp-legend-item">
            <span className="rp-legend-dot" style={{ background: color }} />
            <span>{DISEASE_LABELS[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Disease distribution pie ──────────────────────────────────────────────────
const PieCustomTooltip = memo(({ active, payload, total }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rp-chart-tooltip">
      <div style={{ color: d.payload.color, fontWeight: 700 }}>{d.name}</div>
      <div className="rp-ctt-row">
        <span>Scans</span><strong>{d.value}</strong>
      </div>
      <div className="rp-ctt-row">
        <span>Share</span>
        <strong>{Math.round(d.value / total * 100)}%</strong>
      </div>
    </div>
  );
});

function DiseaseDistribution({ reports }) {
  const pieData = useMemo(() => {
    const counts = {};
    for (const r of reports) {
      const key = r.health || "UNKNOWN";
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({
      name: diseaseLabel(name),
      value,
      color: DISEASE_COLORS[name] ?? DISEASE_COLORS.UNKNOWN,
    }));
  }, [reports]);

  return (
    <div className="rp-card rp-dist-card">
      <div className="rp-card-header">
        <div>
          <div className="rp-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a10 10 0 0 1 10 10H12V2z"/>
            </svg>
            Disease Distribution
          </div>
          <div className="rp-card-sub">Breakdown across all scans</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%" cy="50%"
            innerRadius={50} outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip content={<PieCustomTooltip total={reports.length} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="rp-dist-list">
        {pieData.map((d, i) => (
          <div key={i} className="rp-dist-row">
            <span className="rp-legend-dot" style={{ background: d.color }} />
            <span className="rp-dist-name">{d.name}</span>
            <span className="rp-dist-count">{d.value}</span>
            <span className="rp-dist-pct">{Math.round(d.value / reports.length * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Confidence trend line ─────────────────────────────────────────────────────
function ConfidenceTrend({ reports }) {
  const data = useMemo(() =>
    [...reports].reverse().slice(0, 15).map(r => ({
      date:       fmtShort(r.analyzedAt),
      confidence: Math.round(r.confidence ?? 0),
      severity:   Math.round((r.severity ?? 0) * 100),
    })),
  [reports]);

  return (
    <div className="rp-card rp-trend-card">
      <div className="rp-card-header">
        <div>
          <div className="rp-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Scan Trends
          </div>
          <div className="rp-card-sub">Confidence & severity over time</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} unit="%" />
          <Tooltip
            contentStyle={{ background: "var(--bg-clay)", borderRadius: 10, border: "none", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />
          <Line type="monotone" dataKey="confidence" name="Confidence %" stroke="var(--accent-blue)"
            strokeWidth={2.5} dot={{ r: 4, fill: "white", stroke: "var(--accent-blue)", strokeWidth: 2 }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="severity" name="Severity %" stroke="var(--accent-red)"
            strokeWidth={2} strokeDasharray="5 3"
            dot={{ r: 3, fill: "white", stroke: "var(--accent-red)", strokeWidth: 2 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({ selected }) {
  if (!selected) {
    return (
      <div className="rp-detail-panel rp-detail-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40"
          style={{ color: "var(--text-faint)" }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <p>Select a report to view details</p>
      </div>
    );
  }

  const riskVal = (() => {
    const s = selected.severity ?? 0;
    const n = typeof s === "string" ? { none: 0, medium: 0.5, high: 1 }[s] ?? 0 : s;
    return Math.round(n * 100);
  })();

  const confVal = Math.round(selected.confidence ?? 0);

  return (
    <div className="rp-detail-panel">
      {/* Header */}
      <div className="rp-detail-header">
        <div>
          <div className="rp-detail-id">Scan #{selected.id}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <HealthBadge health={selected.health} />
            <WeatherRiskBadge risk={selected.weatherRisk} />
          </div>
        </div>
        <div className="rp-detail-date">{fmt(selected.analyzedAt)}</div>
      </div>

      {/* Meta grid */}
      <div className="rp-detail-grid">
        {[
          ["Field",      selected.fieldName || "—"],
          ["Grid",       `Row ${selected.rowIndex}, Col ${selected.colIndex}`],
          ["Diagnosis",  diseaseLabel(selected.health)],
          ["Severity",   selected.severityLabel || "—"],
          ["Confidence", `${confVal}%`],
          ["AI Model",   selected.fusionMethod === "hybrid_geometric_mean" ? "Hybrid (DenseNet + Gemini)" : "Local DenseNet"],
        ].map(([label, val]) => (
          <div key={label} className="rp-detail-cell">
            <div className="rp-detail-label">{label}</div>
            <div className="rp-detail-val">{val}</div>
          </div>
        ))}
      </div>

      {/* Gauges */}
      <div className="rp-gauges">
        <RiskGauge value={riskVal} label="Disease Severity" />
        <div className="rp-confidence-col">
          <ConfidenceBar value={confVal} label="Model Confidence" />
          {selected.weatherRisk && selected.weatherRisk !== "Unknown" && (
            <ConfidenceBar
              value={selected.weatherRisk === "High" ? 85 : selected.weatherRisk === "Moderate" ? 50 : 20}
              label="Weather Disease Pressure"
              color={selected.weatherRisk === "High" ? "var(--accent-red)" : selected.weatherRisk === "Moderate" ? "var(--accent-yellow)" : "var(--accent-green)"}
            />
          )}
        </div>
      </div>

      {/* PDF link */}
      {selected.reportPdfUrl ? (
        <a href={selected.reportPdfUrl} target="_blank" rel="noopener noreferrer"
          className="primary-btn rp-pdf-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          Open Full PDF Report
        </a>
      ) : (
        <div className="rp-no-pdf">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          PDF report not available for this scan
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Reports() {
  const {
    reports, loading, error,
    setReports, setLoading, setError, isStale, clearCache,
  } = useReportsStore();

  const [selected,    setSelected]    = useState(null);
  const [search,      setSearch]      = useState("");
  const [activeTab,   setActiveTab]   = useState("list");   // "list" | "analytics"
  const { toasts, show: showToast } = useToast();
  const toastShownRef = useRef(false);

  const fetchReports = useCallback(async (force = false) => {
    if (!force && !isStale()) return;
    setLoading(true);
    try {
      const data = await apiFetch("/plants");
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.content)
        ? data.content
        : [];

      const sorted = [...list].sort(
        (a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt)
      );
      setReports(sorted);
      if (sorted.length > 0 && !selected) setSelected(sorted[0]);
    } catch (err) {
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [isStale, setReports, setLoading, setError, selected]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Show model-scope toast once per session
  useEffect(() => {
    if (!toastShownRef.current) {
      toastShownRef.current = true;
      setTimeout(() => {
        showToast(
          "🍇 Harvest Box currently supports grape leaf analysis only. Results for other crops may not be accurate.",
          "info",
          2000
        );
      }, 1200);
    }
  }, [showToast]);

  const filtered = useMemo(() => {
    if (!search.trim()) return reports;
    const q = search.toLowerCase();
    return reports.filter(r =>
      r.health?.toLowerCase().includes(q) ||
      r.fieldName?.toLowerCase().includes(q) ||
      String(r.rowIndex).includes(q) ||
      String(r.colIndex).includes(q)
    );
  }, [reports, search]);

  function handleRefresh() {
    clearCache();
    fetchReports(true);
    showToast("Refreshing reports…", "info", 2500);
  }

  return (
    <ErrorBoundary onRetry={() => { clearCache(); fetchReports(true); }}>
      <div className="rp-root app-page">
        <ToastContainer toasts={toasts} />

        {/* ── Page header ── */}
        <div className="rp-page-header">
          <div className="rp-brand">
            <div className="rp-brand-icon">
              <Icon size={40} />
            </div>
            <div>
              <h1 className="rp-page-title">Harvest Box</h1>
              <p className="rp-page-sub">Crop Health Analysis Reports</p>
            </div>
          </div>

          <div className="rp-header-actions">
            <div className="rp-tabs">
              <button
                className={`rp-tab${activeTab === "list" ? " active" : ""}`}
                onClick={() => setActiveTab("list")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                Reports
              </button>
              <button
                className={`rp-tab${activeTab === "analytics" ? " active" : ""}`}
                onClick={() => setActiveTab("analytics")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                Analytics
              </button>
            </div>
            <button className="rp-refresh-btn" onClick={handleRefresh}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {loading && <ReportSkeleton />}

        {error && (
          <RetryBanner message={error} onRetry={handleRefresh} />
        )}

        {!loading && !error && reports.length === 0 && <EmptyState />}

        {!loading && !error && reports.length > 0 && (
          <>
            {/* Analytics tab */}
            {activeTab === "analytics" && (
              <div className="rp-analytics-view">
                <AnalyticsSummary reports={reports} />
                <PlantRatingsGraph reports={reports} />
                <div className="rp-charts-row">
                  <DiseaseDistribution reports={reports} />
                  <ConfidenceTrend reports={reports} />
                </div>
              </div>
            )}

            {/* List / detail tab */}
            {activeTab === "list" && (
              <div className="rp-frame">
                {/* Left panel */}
                <div className="rp-list-panel clay-card">
                  <div className="rp-search-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      className="rp-search"
                      type="text"
                      placeholder="Search by field, disease, grid…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                      <button className="rp-clear-search" onClick={() => setSearch("")}>✕</button>
                    )}
                  </div>

                  {filtered.length === 0 && (
                    <p className="rp-no-results">No matching reports.</p>
                  )}

                  <div className="rp-list">
                    {filtered.map(r => (
                      <button
                        key={r.id}
                        className={`rp-row${selected?.id === r.id ? " active" : ""}`}
                        onClick={() => setSelected(r)}
                      >
                        <div className="rp-row-top">
                          <span className="rp-row-grid">
                            ({r.rowIndex}, {r.colIndex})
                            {r.fieldName ? ` · ${r.fieldName}` : ""}
                          </span>
                          <span className="rp-row-date">{fmtShort(r.analyzedAt)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <HealthBadge health={r.health} />
                          {r.weatherRisk && r.weatherRisk !== "Unknown" && (
                            <span className="rp-mini-risk"
                              style={{ color: severityColor(r.severity) }}>
                              {r.weatherRisk} risk
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right detail panel */}
                <div className="clay-card" style={{ overflow: "hidden" }}>
                  <DetailPanel selected={selected} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
