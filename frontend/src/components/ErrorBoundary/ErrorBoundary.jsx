import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="eb-wrap">
        <div className="eb-card clay-card">
          <div className="eb-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h2>Something went wrong</h2>
          <p className="eb-detail">
            {this.props.label ?? "An unexpected error occurred."}
          </p>
          {this.props.showRetry !== false && (
            <button
              className="primary-btn"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onRetry?.();
              }}
            >
              Try again
            </button>
          )}
        </div>
        <style>{`
          .eb-wrap {
            display: flex; align-items: center; justify-content: center;
            min-height: 340px; padding: 32px;
          }
          .eb-card {
            max-width: 420px; width: 100%;
            padding: 40px 36px;
            text-align: center;
            display: flex; flex-direction: column; align-items: center; gap: 12px;
          }
          .eb-icon { color: var(--accent-red); margin-bottom: 4px; }
          .eb-card h2 { font-size: 1.2rem; font-weight: 700; color: var(--text-dark); }
          .eb-detail { font-size: 0.88rem; color: var(--text-muted); line-height: 1.5; max-width: 300px; }
          .eb-card .primary-btn { margin-top: 8px; }
        `}</style>
      </div>
    );
  }
}
