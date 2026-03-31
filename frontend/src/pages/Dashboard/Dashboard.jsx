import { useEffect, useState, useMemo, memo } from "react";
import { getWeatherAndForecast } from "../../services/weatherService.js";
import { useForecastStore, useReportsStore } from "../../store/useAppStore";
import { apiFetch } from "../../api/client";
import Icon from "../../components/Icon/Icon.jsx";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import "./dashboard.css";

/* ── Constants ── */
const WIND_DIRS  = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const CHART_TABS = [["temp","Temperature °C"],["hum","Humidity %"],["wind","Wind m/s"]];
const CHART_KEY  = { temp: "hi", hum: "humidity", wind: "windSpeed" };

const DISEASE_COLORS = {
  Healthy:       "#3a7d44",
  Black_Rot:     "#e53935",
  Downy_Mildew:  "#2563eb",
  Powdery_Mildew:"#f9a825",
};

const windDir = d => d == null ? "—" : WIND_DIRS[Math.round(d / 22.5) % 16];
const fmtTime = u => u ? new Date(u * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
const clamp   = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmtShort = iso => iso ? new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "?";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function diseaseLabel(h) {
  if (!h) return "Unknown";
  return { Healthy: "Healthy", Black_Rot: "Black Rot", Downy_Mildew: "Downy Mildew", Powdery_Mildew: "Powdery Mildew" }[h] ?? h.replace(/_/g, " ");
}

/* ── Sparkline ── */
const Sparkline = memo(function Sparkline({ points, color }) {
  if (!points?.length) return null;
  const max = Math.max(...points), min = Math.min(...points), range = max - min || 1;
  const pts = points.map((v, i) =>
    `${(i / (points.length - 1)) * 112 + 4},${36 - ((v - min) / range) * 32}`
  ).join(" ");
  return (
    <svg viewBox="0 0 120 40" className="sparkline" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});

/* ── Forecast chart ── */
const ForecastChart = memo(function ForecastChart({ forecast, tab }) {
  const pts = forecast.map(f => f[CHART_KEY[tab]]);
  const max = Math.max(...pts), min = Math.min(...pts), range = max - min || 1;
  const W = 500, H = 90, px = 28, py = 16;
  const coords = pts.map((v, i) => ({
    x: px + (i / (pts.length - 1 || 1)) * (W - px * 2),
    y: py + (1 - (v - min) / range) * (H - py * 2),
    v,
  }));
  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaD = `${pathD} L${coords[coords.length-1].x},${H} L${coords[0].x},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`grad-${tab}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={`var(--chart-${tab})`} stopOpacity="0.18" />
          <stop offset="100%" stopColor={`var(--chart-${tab})`} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${tab})`} />
      <path d={pathD} fill="none" stroke={`var(--chart-${tab})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <g key={i} className="chart-point">
          <circle cx={c.x} cy={c.y} r="5" fill="white" stroke={`var(--chart-${tab})`} strokeWidth="2" />
          <text x={c.x} y={c.y - 10} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{c.v}</text>
        </g>
      ))}
    </svg>
  );
});

/* ── Alerts — combines weather + plant data ── */
function buildAlerts(c, fc, reports) {
  if (!c || !fc.length) return [];
  const alerts = [];

  // Weather alerts
  const rainDay = fc.find(f => f.pop > 60);
  if (rainDay)          alerts.push(["info", `Heavy rain expected ${rainDay.day} — delay fertiliser application`]);
  if (c.windSpeed > 8)  alerts.push(["warn", `Strong winds ${c.windSpeed} m/s — secure crop covers`]);
  if (c.humidity > 80)  alerts.push(["warn", `High humidity ${c.humidity}% — monitor for fungal risk`]);
  if (c.temperature > 35) alerts.push(["warn", "Heat stress risk — consider extra irrigation today"]);

  // Plant health alerts from recent reports
  if (reports?.length) {
    const recent   = reports.slice(0, 10);
    const diseased = recent.filter(r => r.health && r.health !== "Healthy");
    const highRisk = recent.filter(r => r.weatherRisk === "High");

    if (diseased.length > 0) {
      const diseases = [...new Set(diseased.map(r => diseaseLabel(r.health)))];
      alerts.push(["warn", `${diseased.length} diseased scan(s) found — ${diseases.join(", ")} detected. Check Field Setup for treatment.`]);
    }

    if (highRisk.length > 0) {
      alerts.push(["warn", `${highRisk.length} scan(s) under HIGH weather disease pressure. Increase monitoring frequency.`]);
    }

    const recentHealthy = recent.filter(r => r.health === "Healthy");
    if (recentHealthy.length === recent.length && recent.length > 0) {
      alerts.push(["ok", `All ${recent.length} recent scans are healthy — field looks good!`]);
    }
  }

  if (!alerts.some(([t]) => t === "warn")) {
    alerts.push(["ok", "All field conditions are good — ideal farming day"]);
  }

  const best = fc.reduce((b, f) => (f.pop < b.pop && f.hi < 35 ? f : b), fc[0]);
  alerts.push(["ok", `Best outdoor window: ${best?.day ?? "Today"}`]);
  return alerts;
}

/* ── Skeleton ── */
function DashboardSkeleton() {
  return (
    <div className="db-skeleton-grid">
      {[280, 140, 120, 120, 120, 120, 220, 180, 120].map((h, i) => (
        <div key={i} className="skeleton db-sk-item" style={{
          height: h,
          gridColumn: i === 0 ? "span 5" : i === 1 ? "span 7" : i === 6 ? "span 8" : i === 7 ? "span 4" : "span 3"
        }} />
      ))}
    </div>
  );
}

/* ── Metric card ── */
const MetricCard = memo(function MetricCard({ label, big, sub, spark, color, bar }) {
  return (
    <div className="db-card db-metric">
      <div className="db-metric-top">
        <div className="section-label">{label}</div>
        <div className="db-metric-big">{big}</div>
        <div className="db-metric-sub">{sub}</div>
      </div>
      {spark
        ? <Sparkline points={spark} color={color} />
        : (
          <div className="db-feels-track">
            <div className="db-feels-fill" style={{ width: `${bar}%` }} />
          </div>
        )
      }
    </div>
  );
});

/* ── Forecast day button ── */
const ForecastDay = memo(function ForecastDay({ f, active, onClick }) {
  return (
    <button className={`db-fday${active ? " active" : ""}`} onClick={onClick}>
      <span className="db-fday-name">{f.day}</span>
      <span className="db-fday-hi">{f.hi}°</span>
      <span className="db-fday-lo">{f.lo}°</span>
      {f.pop > 0 && <span className="db-fday-rain">{f.pop}%</span>}
    </button>
  );
});

/* ── Scan Trends card ── */
const ScanTrendsCard = memo(function ScanTrendsCard({ reports }) {
  const recent = useMemo(() => [...(reports || [])].slice(0, 8), [reports]);

  if (!recent.length) {
    return (
      <div className="db-card db-scan-trends">
        <div className="section-label">Recent Scan Trends</div>
        <div className="db-trends-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
            <path d="M8 12l2 2 4-4"/>
          </svg>
          <p>No scans yet — go to Field Setup to begin</p>
        </div>
      </div>
    );
  }

  const healthy  = recent.filter(r => r.health === "Healthy").length;
  const diseased = recent.length - healthy;
  const avgConf  = Math.round(recent.reduce((s, r) => s + (r.confidence ?? 0), 0) / recent.length);

  // Disease count breakdown
  const diseaseCounts = {};
  for (const r of recent) {
    const k = r.health || "Unknown";
    diseaseCounts[k] = (diseaseCounts[k] || 0) + 1;
  }

  return (
    <div className="db-card db-scan-trends">
      <div className="db-trends-header">
        <div className="section-label">Recent Scan Trends</div>
        <span className="db-trends-count">{recent.length} scans</span>
      </div>

      {/* Mini summary pills */}
      <div className="db-trends-pills">
        <div className="db-trend-pill db-trend-pill-green">
          <span>{healthy}</span> Healthy
        </div>
        <div className="db-trend-pill db-trend-pill-red">
          <span>{diseased}</span> Diseased
        </div>
        <div className="db-trend-pill db-trend-pill-blue">
          <span>{avgConf}%</span> Avg Confidence
        </div>
      </div>

      {/* Disease breakdown bars */}
      <div className="db-disease-bars">
        {Object.entries(diseaseCounts).map(([disease, count]) => {
          const pct = Math.round(count / recent.length * 100);
          const color = DISEASE_COLORS[disease] ?? "#9aaa9a";
          return (
            <div key={disease} className="db-disease-bar-row">
              <span className="db-disease-name">{diseaseLabel(disease)}</span>
              <div className="db-disease-track">
                <div className="db-disease-fill" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="db-disease-pct">{pct}%</span>
            </div>
          );
        })}
      </div>

      {/* Recent scan list */}
      <div className="db-scan-list">
        {recent.slice(0, 5).map(r => {
          const color = DISEASE_COLORS[r.health] ?? "#9aaa9a";
          return (
            <div key={r.id} className="db-scan-row">
              <div className="db-scan-dot" style={{ background: color }} />
              <div className="db-scan-info">
                <span className="db-scan-pos">({r.rowIndex},{r.colIndex}){r.fieldName ? ` · ${r.fieldName}` : ""}</span>
                <span className="db-scan-disease" style={{ color }}>{diseaseLabel(r.health)}</span>
              </div>
              <div className="db-scan-meta">
                <span className="db-scan-conf">{Math.round(r.confidence ?? 0)}%</span>
                <span className="db-scan-date">{fmtShort(r.analyzedAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ── Main component ── */
export default function Dashboard() {
  const { data, loading, error, setData, setLoading, setError, isStale } = useForecastStore();
  const { reports, setReports, isStale: reportsStale } = useReportsStore();
  const [activeDay, setActiveDay] = useState(0);
  const [chartTab, setChartTab]   = useState("temp");

  // Fetch weather
  useEffect(() => {
    if (!isStale()) return;
    setLoading(true);
    getWeatherAndForecast()
      .then(r  => setData(r))
      .catch(e => setError(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch recent plant reports for the Trends card
  useEffect(() => {
    if (!reportsStale()) return;
    apiFetch("/plants?page=0&size=10")
      .then(data => {
        const list = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : [];
        setReports(list);
      })
      .catch(() => {}); // silent — trends card shows empty state
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const c      = data?.current;
  const fc     = useMemo(() => data?.forecast ?? [], [data]);
  const day    = fc[activeDay];
  const alerts = useMemo(() => buildAlerts(c, fc, reports), [c, fc, reports]);

  const metrics = useMemo(() => {
    if (!c) return [];
    return [
      { label: "Temperature", big: `${c.temperature}°C`, sub: `H: ${c.high}° · L: ${c.low}°`,        spark: fc.map(d => d.hi),        color: "var(--chart-temp)" },
      { label: "Humidity",    big: `${c.humidity}%`,     sub: c.humidity > 70 ? "High" : c.humidity < 40 ? "Low" : "Optimal", spark: fc.map(d => d.humidity), color: "var(--chart-hum)" },
      { label: "Wind Speed",  big: `${c.windSpeed} m/s`, sub: `Dir. ${windDir(c.windDeg)}`,           spark: fc.map(d => d.windSpeed), color: "var(--chart-wind)" },
      { label: "Feels Like",  big: `${c.feelsLike}°C`,  sub: c.feelsLike > c.temperature ? "Warmer than actual" : c.feelsLike < c.temperature ? "Cooler than actual" : "Same as actual", bar: clamp((c.feelsLike + 10) / 50 * 100, 0, 100) },
    ];
  }, [c, fc]);

  const handleWeatherRetry = () => {
    setError(null);
    setLoading(true);
    getWeatherAndForecast().then(setData).catch(e => setError(e.message));
  };

  return (
    <ErrorBoundary label="Dashboard failed to load." onRetry={handleWeatherRetry}>
      <div className="db-root app-page">
        {/* Topbar */}
        <div className="db-topbar">
          <div>
            <h1 className="db-greeting">{greeting()}</h1>
            <p className="db-status">
              <span className="db-live-dot" />
              {c ? `${c.location}, ${c.country} · Live` : "Fetching live field data…"}
            </p>
          </div>
          <div className="db-topbar-right">
            <div className="db-brand-pill">
                <Icon size={18} />
                Harvest Box
            </div>
          </div>
        </div>

        {error && (
          <div className="db-error-banner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
            <button className="db-retry-btn" onClick={handleWeatherRetry}>Retry</button>
          </div>
        )}

        {loading && !error && <DashboardSkeleton />}

        {c && (
          <div className="db-bento">
            {/* ── Weather hero ── */}
            <div className="db-card db-weather-hero">
              <div className="section-label" style={{ color: "rgba(255,255,255,0.6)" }}>Current Weather</div>
              <div className="db-wh-body">
                <div className="db-wh-temp">{c.temperature}°</div>
                <div className="db-wh-desc">{c.description}</div>
                <div className="db-wh-loc">{c.location}, {c.country}</div>
              </div>
              <div className="db-wh-stats">
                {[["Humidity", `${c.humidity}%`], ["Wind", `${c.windSpeed} m/s`], ["Feels like", `${c.feelsLike}°`], ["Pressure", `${c.pressure} hPa`]].map(([l, v]) => (
                  <div key={l} className="db-wstat">
                    <div className="db-wstat-l">{l}</div>
                    <div className="db-wstat-v">{v}</div>
                  </div>
                ))}
              </div>
              <div className="db-wh-footer">
                <span>↑ {fmtTime(c.sunrise)}</span>
                <span>↓ {fmtTime(c.sunset)}</span>
                {c.visibility != null && <span>Vis. {c.visibility} km</span>}
              </div>
            </div>

            {/* ── Scan Trends card (NEW) ── */}
            <ScanTrendsCard reports={reports} />

            {/* ── Forecast strip ── */}
            <div className="db-card db-forecast">
              <div className="section-label">{fc.length}-Day Forecast</div>
              <div className="db-fdays">
                {fc.map((f, i) => (
                  <ForecastDay key={f.date} f={f} active={i === activeDay} onClick={() => setActiveDay(i)} />
                ))}
              </div>
            </div>

            {/* ── Day detail ── */}
            {day && (
              <div className="db-card db-day-detail">
                <div className="section-label">{day.day} Detail</div>
                <div className="db-dd-grid">
                  {[["Condition", day.condition], ["High / Low", `${day.hi}° / ${day.lo}°`], ["Humidity", `${day.humidity}%`], ["Wind", `${day.windSpeed} m/s`], ["Rain chance", `${day.pop}%`]].map(([l, v]) => (
                    <div key={l} className="db-dd-cell">
                      <span className="db-dd-l">{l}</span>
                      <span className="db-dd-v">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Metric cards ── */}
            {metrics.map(m => <MetricCard key={m.label} {...m} />)}

            {/* ── Forecast trend chart ── */}
            <div className="db-card db-chart">
              <div className="db-chart-header">
                <div className="section-label">Forecast Trends</div>
                <div className="db-chart-tabs">
                  {CHART_TABS.map(([key, lbl]) => (
                    <button
                      key={key}
                      className={`db-ctab${chartTab === key ? " active" : ""}`}
                      onClick={() => setChartTab(key)}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="db-chart-area">
                {fc.length > 0 && <ForecastChart forecast={fc} tab={chartTab} />}
              </div>
              <div className="db-chart-days">
                {fc.map(f => <span key={f.date}>{f.day}</span>)}
              </div>
            </div>

            {/* ── Rain probability ── */}
            <div className="db-card db-rain">
              <div className="section-label">Rain Probability</div>
              <div className="db-rain-bars">
                {fc.map(f => (
                  <div key={f.date} className="db-rain-col">
                    <span className="db-rain-pct">{f.pop}%</span>
                    <div className="db-rain-track">
                      <div
                        className="db-rain-fill"
                        data-level={f.pop > 60 ? "high" : f.pop > 30 ? "mid" : "low"}
                        style={{ height: `${Math.max(4, f.pop)}%` }}
                      />
                    </div>
                    <span className="db-rain-day">{f.day.slice(0, 2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Smart alerts ── */}
            <div className="db-card db-alerts">
              <div className="section-label">Smart Field Alerts</div>
              <div className="db-alert-list">
                {alerts.map(([type, text], i) => (
                  <div key={i} className={`db-alert-row db-alert-${type}`}>
                    <span className="db-alert-dot" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
