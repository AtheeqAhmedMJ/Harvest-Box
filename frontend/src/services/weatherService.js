/**
 * weatherService.js
 * Fetches current weather + 5-day forecast via the backend proxy.
 *
 * The OpenWeatherMap API key lives only on the server (application-dev.yml → WEATHER_API_KEY).
 * The frontend never sees the key — it calls /api/v1/weather?lat=...&lon=... instead.
 *
 * Location strategy: GPS → IP fallback → throw.
 */

import { apiFetch } from "../api/client.js";

/* ── Location helpers ── */
function gpsLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(new Error(err.message)),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  });
}

async function ipLocation() {
  const res  = await fetch("https://ipapi.co/json/");
  const data = await res.json();
  if (!data.latitude || !data.longitude) throw new Error("Invalid IP location data");
  return { lat: data.latitude, lon: data.longitude };
}

export async function getCoords() {
  try {
    return await gpsLocation();
  } catch {
    return ipLocation();
  }
}

/* ── Data normalisers ── */
function normaliseCurrentWeather(d) {
  return {
    location:    d.name,
    country:     d.sys?.country ?? "",
    temperature: Math.round(d.main.temp),
    humidity:    d.main.humidity,
    windSpeed:   parseFloat(d.wind.speed.toFixed(1)),
    windDeg:     d.wind.deg ?? null,
    condition:   d.weather?.[0]?.main ?? "Unknown",
    description: d.weather?.[0]?.description ?? "",
    icon:        d.weather?.[0]?.icon ?? "01d",
    high:        Math.round(d.main.temp_max),
    low:         Math.round(d.main.temp_min),
    feelsLike:   Math.round(d.main.feels_like),
    pressure:    d.main.pressure,
    visibility:  d.visibility != null ? Math.round(d.visibility / 1000) : null,
    sunrise:     d.sys?.sunrise ?? null,
    sunset:      d.sys?.sunset  ?? null,
  };
}

function normaliseForecast(d) {
  const byDay = {};
  for (const entry of d.list) {
    const date = entry.dt_txt.split(" ")[0];
    (byDay[date] ??= []).push(entry);
  }

  return Object.entries(byDay).map(([dateStr, entries]) => {
    const temps = entries.map(e => e.main.temp);
    const noon  = entries.find(e => e.dt_txt.includes("12:00")) ?? entries[0];
    const date  = new Date(`${dateStr}T00:00:00`);
    return {
      date:        dateStr,
      day:         date.toLocaleDateString("en-US", { weekday: "short" }),
      hi:          Math.round(Math.max(...temps)),
      lo:          Math.round(Math.min(...temps)),
      condition:   noon.weather?.[0]?.main ?? "Unknown",
      description: noon.weather?.[0]?.description ?? "",
      icon:        noon.weather?.[0]?.icon ?? "01d",
      humidity:    Math.round(entries.reduce((s, e) => s + e.main.humidity, 0) / entries.length),
      windSpeed:   parseFloat((entries.reduce((s, e) => s + e.wind.speed, 0) / entries.length).toFixed(1)),
      pop:         Math.round((entries.reduce((s, e) => s + (e.pop ?? 0), 0) / entries.length) * 100),
    };
  });
}

/* ── Public API ── */
export async function getWeatherAndForecast() {
  const { lat, lon } = await getCoords();

  // Both requests go through the authenticated backend proxy
  const [curData, fcData] = await Promise.all([
    apiFetch(`/weather?lat=${lat}&lon=${lon}`),
    apiFetch(`/weather/forecast?lat=${lat}&lon=${lon}`),
  ]);

  return {
    current:  normaliseCurrentWeather(curData),
    forecast: normaliseForecast(fcData),
    coords:   { lat, lon },           // expose coords so FieldSetup can use them
  };
}
