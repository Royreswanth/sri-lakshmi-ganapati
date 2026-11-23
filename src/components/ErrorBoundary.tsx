import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error?.message || "Unexpected application error";
    try {
      const parsed = JSON.parse(readable);
      if (parsed && typeof parsed.error === "string") {
        readable = parsed.error;
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, errorMessage: readable };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("LineBook Pro ErrorBoundary:", error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#EDF1F7] dark:bg-[#0B0F19] flex items-center justify-center p-5">
          <div className="max-w-sm w-full rounded-3xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 p-6 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                Something Went Wrong
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Your local village &amp; borrower data is safe on this device. Tap reload to resume.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-rose-700 dark:text-rose-300 break-words">
              {this.state.errorMessage}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-2xl bg-[#1E3A8A] hover:bg-blue-900 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
