import { Component } from "react";

export class ErrorBoundary extends Component {
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
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)] p-8">
            <div className="max-w-md rounded-[var(--radius-lg)] border border-[var(--border-color)] bg-[var(--bg-panel)] p-8 text-center shadow-[var(--shadow-soft)]">
              <p className="mb-2 text-2xl">⚠️</p>
              <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
                Algo salió mal
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {this.state.error?.message ?? "Error inesperado"}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="mt-5 rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-muted)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
              >
                Reintentar
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}