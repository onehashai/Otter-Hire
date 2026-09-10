"use client";

import React, { Component, ReactNode } from "react";
import { Button } from "@onehash/ui/button";
import { Icon } from "@onehash/ui/icon";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center p-8 gap-3 text-center border rounded-lg bg-card my-4">
          <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <Icon name="AlertCircle" className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">Something went wrong rendering this view</p>
          <p className="text-xs font-semibold text-destructive max-w-lg break-words">
            {this.state.error?.name ? `${this.state.error.name}: ${this.state.error.message}` : this.state.error?.message || "An unexpected client-side error occurred."}
          </p>
          {this.state.error?.stack && (
            <pre className="text-[10px] text-left text-muted-foreground overflow-auto max-w-xl max-h-40 p-2 bg-muted rounded font-mono whitespace-pre-wrap">
              {this.state.error.stack}
            </pre>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            Reload Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
