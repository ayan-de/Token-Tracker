"use client";

import { Component, type ReactNode, Suspense } from "react";

interface Props { children: ReactNode; loader?: ReactNode; }
interface State { hasError: boolean; message?: string; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-4 text-center gap-2">
          <span className="text-red-400 text-lg">⚠</span>
          <span className="text-red-500 text-sm">{this.state.message ?? "Something went wrong"}</span>
          <button
            className="text-xs text-red-400 hover:text-red-300 underline"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <Suspense fallback={this.props.loader ?? <Skeleton />}>
        {this.props.children}
      </Suspense>
    );
  }
}

function Skeleton() {
  return <div className="animate-pulse bg-[var(--color-border)] h-8 rounded" />;
}
