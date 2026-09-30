import { Component, type ErrorInfo, type ReactNode } from "react";
import { normalizeError } from "@shared/api";

export interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: ReturnType<typeof normalizeError> | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { error: normalizeError(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("Application error boundary", { error: normalizeError(error), componentStack: info.componentStack });
  }

  override render() {
    if (this.state.error !== null) {
      return (
        <main>
          <h1>Application unavailable</h1>
          <p role="alert">{this.state.error.message}</p>
          <button type="button" onClick={() => { this.setState({ error: null }); }}>Try again</button>
        </main>
      );
    }
    return this.props.children;
  }
}