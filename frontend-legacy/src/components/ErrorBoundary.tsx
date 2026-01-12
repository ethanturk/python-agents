import React, { Component, ErrorInfo, ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error Boundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Log to error reporting service here if needed
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[80vh]">
            <Card className="p-8 text-center max-w-2xl w-full">
              <AlertCircle className="mx-auto h-16 w-16 text-destructive mb-4" />
              <h1 className="text-3xl font-bold mb-4">
                Oops! Something went wrong
              </h1>
              <p className="text-muted-foreground mb-6">
                We apologize for the inconvenience. The application has
                encountered an unexpected error.
              </p>

              {import.meta.env.DEV && this.state.error && (
                <Alert variant="destructive" className="mb-6 text-left">
                  <AlertTitle>Error Details</AlertTitle>
                  <AlertDescription>
                    <pre className="text-xs overflow-auto max-h-[200px] whitespace-pre-wrap mt-2">
                      {this.state.error.toString()}
                      {this.state.errorInfo &&
                        this.state.errorInfo.componentStack}
                    </pre>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-4 justify-center">
                <Button onClick={this.handleReset}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button variant="outline" onClick={this.handleReload}>
                  Reload Page
                </Button>
              </div>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
