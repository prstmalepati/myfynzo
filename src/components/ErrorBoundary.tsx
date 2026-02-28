// =============================================================
// components/ErrorBoundary.tsx — Graceful error handling
// =============================================================
// Wraps sections of the app so a crash in one area doesn't
// take down the entire application. Critical for financial apps.

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** What to show when something breaks */
  fallback?: ReactNode;
  /** Section name for logging */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const section = this.props.section || 'Unknown';
    console.error(`[ErrorBoundary:${section}] Caught error:`, error, errorInfo);
    // TODO: Send to Sentry/Crashlytics in production
    // Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[300px] flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 mx-auto mb-5 bg-red-50 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-secondary mb-2">Something went wrong</h3>
            <p className="text-sm text-slate-500 mb-5">
              {this.props.section
                ? `An error occurred in the ${this.props.section} section. Your data is safe.`
                : 'An unexpected error occurred. Your data is safe.'}
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-xs text-left bg-red-50 border border-red-100 rounded-lg p-3 mb-4 overflow-auto max-h-32 text-red-700">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Full-page error boundary for route-level wrapping */
export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[PageErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-lg text-center">
            <img src="/logo-transparent.png" alt="myfynzo" className="w-14 h-14 mx-auto mb-6 opacity-60" />
            <h1 className="text-2xl font-bold text-secondary mb-3 font-display">Oops — something broke</h1>
            <p className="text-slate-500 mb-6 leading-relaxed">
              We hit an unexpected error. Don't worry — your financial data is safe in the cloud.
              Try refreshing, or go back to the dashboard.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-xs text-left bg-red-50 border border-red-100 rounded-lg p-4 mb-6 overflow-auto max-h-40 text-red-700">
                {this.state.error.message}{'\n'}{this.state.error.stack}
              </pre>
            )}
            <div className="flex items-center justify-center gap-3">
              <a
                href="/dashboard"
                className="px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/10"
              >
                Back to Dashboard
              </a>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-white text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-50 transition-colors border border-slate-200"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
