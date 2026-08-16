import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

/** 根级错误边界：渲染异常不白屏，给出可恢复提示 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[app] error boundary:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>页面出错了</h2>
            <p style={{ color: "#666", fontSize: 14, wordBreak: "break-all" }}>{this.state.error.message}</p>
            <button
              onClick={() => location.reload()}
              style={{ marginTop: 12, padding: "8px 20px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 14 }}
            >
              刷新重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
