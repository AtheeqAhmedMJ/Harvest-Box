import { create } from "zustand";

// ── Reports store ──────────────────────────────────────────
export const useReportsStore = create((set, get) => ({
  reports: [],
  loading: false,
  error: null,
  lastFetched: null,

  setReports: (reports) => set({ reports, lastFetched: Date.now(), error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),

  // Optimistic add after upload
  addReport: (report) =>
    set((state) => ({ reports: [report, ...state.reports] })),

  // Cache validity: 60 seconds
  isStale: () => {
    const { lastFetched } = get();
    return !lastFetched || Date.now() - lastFetched > 60_000;
  },

  clearCache: () => set({ lastFetched: null }),
}));

// ── Upload status store ────────────────────────────────────
export const useUploadStore = create((set) => ({
  status: "idle", // idle | uploading | processing | generating | done | error
  progress: 0,
  message: "",
  result: null,
  error: null,

  start: () =>
    set({ status: "uploading", progress: 10, message: "Uploading image…", result: null, error: null }),

  setProcessing: () =>
    set({ status: "processing", progress: 45, message: "AI is analyzing your leaf sample…" }),

  setGenerating: () =>
    set({ status: "generating", progress: 80, message: "Generating health report…" }),

  setDone: (result) =>
    set({ status: "done", progress: 100, message: "Report ready!", result }),

  setError: (error) =>
    set({ status: "error", progress: 0, message: error, error }),

  reset: () =>
    set({ status: "idle", progress: 0, message: "", result: null, error: null }),
}));

// ── Forecast / weather cache store ────────────────────────
export const useForecastStore = create((set, get) => ({
  data: null,
  loading: false,
  error: null,
  lastFetched: null,

  setData: (data) => set({ data, lastFetched: Date.now(), error: null, loading: false }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),

  isStale: () => {
    const { lastFetched } = get();
    // Weather stale after 10 minutes
    return !lastFetched || Date.now() - lastFetched > 10 * 60_000;
  },
}));
