import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleFullReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const msg = this.state.error?.message || "";
      const isComponentCrash =
        msg.includes("is not a function") ||
        msg.includes("is not a component") ||
        msg.includes("Element type is invalid");

      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <div>
            <h3 className="font-semibold text-lg">
              {isComponentCrash ? "A component failed to load" : "Something went wrong"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {isComponentCrash
                ? "This usually fixes itself with a page refresh."
                : msg || "An unexpected error occurred"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.handleReset}>
              Try Again
            </Button>
            {isComponentCrash && (
              <Button onClick={this.handleFullReload}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Page
              </Button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
