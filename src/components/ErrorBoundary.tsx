import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
              System Encountered a Bug
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium">
              We've encountered an unexpected error. The system might be trying
              to load cached data that is no longer compatible.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-8 text-left border border-slate-100 dark:border-slate-800 overflow-hidden">
              <p className=" font-black text-slate-400 uppercase tracking-widest mb-1">
                Error Message
              </p>
              <p className="text-xs font-mono text-red-600 dark:text-red-400 break-words line-clamp-3">
                {error?.message || "Unknown Error"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none"
              >
                <RefreshCw className="w-4 h-4" />
                Reload App
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.href = "/";
                }}
                className="flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Home className="w-4 h-4" />
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
