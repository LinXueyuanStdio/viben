import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "@/i18n";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class YooptaErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[YooptaEditor] Render error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--muted-foreground, #666)",
          }}
        >
          <p style={{ marginBottom: "0.5rem", fontSize: "0.875rem" }}>
            {i18n.t("editor.errorBoundary.message", "Something went wrong loading the editor.")}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: "0.375rem 0.75rem",
              fontSize: "0.8125rem",
              border: "1px solid var(--border, #e2e2e2)",
              borderRadius: "0.375rem",
              background: "var(--background, #fff)",
              color: "var(--foreground, #333)",
              cursor: "pointer",
            }}
          >
            {i18n.t("editor.errorBoundary.tryAgain", "Try again")}
          </button>
          {this.state.error && (
            <details
              style={{
                marginTop: "1rem",
                fontSize: "0.75rem",
                textAlign: "left",
              }}
            >
              <summary style={{ cursor: "pointer" }}>{i18n.t("editor.errorBoundary.errorDetails", "Error details")}</summary>
              <pre
                style={{
                  marginTop: "0.5rem",
                  padding: "0.5rem",
                  background: "var(--muted, #f5f5f5)",
                  borderRadius: "0.25rem",
                  overflow: "auto",
                  maxHeight: "200px",
                  fontSize: "0.6875rem",
                }}
              >
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
