import React from "react";

const ff = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh", background: "#0D0F1A", fontFamily: ff,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "24px"
      }}>
        <div style={{ textAlign: "center", maxWidth: "420px" }}>
          <div style={{
            fontSize: "22px", color: "#E8192C", fontWeight: 800, letterSpacing: ".5px",
            textTransform: "uppercase", marginBottom: "6px"
          }}>ICON REMODELING GROUP INC.</div>
          <div style={{
            fontSize: "11px", color: "rgba(255,255,255,0.7)", letterSpacing: "4px",
            textTransform: "uppercase", marginBottom: "36px"
          }}>Work Orders</div>

          <div style={{
            background: "#131929", border: "1px solid #1E2845", borderRadius: "18px",
            padding: "32px 24px", boxShadow: "0 8px 32px rgba(0,0,0,.5)"
          }}>
            <div style={{ fontSize: "44px", marginBottom: "12px" }}>⚠️</div>
            <h1 style={{
              fontSize: "20px", color: "#F0F4FF", margin: "0 0 8px", fontWeight: 700
            }}>Something went wrong</h1>
            <p style={{
              fontSize: "13px", color: "#4A5A7A", margin: "0 0 24px", lineHeight: 1.6
            }}>
              The app hit an unexpected error. Tap reload to continue — your data is safe.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: "100%", padding: "14px", border: "none", borderRadius: "10px",
                background: "linear-gradient(135deg,#3B6FEF 0%,#5B9BFF 100%)",
                color: "#fff", fontSize: "15px", fontWeight: 700, cursor: "pointer",
                fontFamily: ff, boxShadow: "0 0 20px rgba(79,127,255,.3)"
              }}
            >
              Reload App
            </button>
          </div>

          {this.state.error && (
            <div style={{
              marginTop: "20px", padding: "12px", background: "rgba(244,63,94,.05)",
              border: "1px solid rgba(244,63,94,.2)", borderRadius: "10px",
              fontSize: "11px", color: "#F43F5E", textAlign: "left",
              fontFamily: "monospace", wordBreak: "break-word"
            }}>
              {String(this.state.error?.message || this.state.error)}
            </div>
          )}
        </div>
      </div>
    );
  }
}
