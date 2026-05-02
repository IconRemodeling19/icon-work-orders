import React from "react";

const ff = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

const shimmerKeyframes = `
@keyframes wo-shimmer {
  0%   { background-position: -800px 0; }
  100% { background-position:  800px 0; }
}
`;

const skeletonStyle = {
  background: "linear-gradient(90deg, #161b22 0%, #1e2328 50%, #161b22 100%)",
  backgroundSize: "1600px 100%",
  animation: "wo-shimmer 1.4s linear infinite",
  borderRadius: "8px",
};

export function SkeletonStyles() {
  return <style>{shimmerKeyframes}</style>;
}

export function SkeletonLine({ width = "100%", height = 14, mb = 8, style }) {
  return (
    <div style={{
      ...skeletonStyle, width, height, marginBottom: mb,
      borderRadius: "6px", ...style
    }} />
  );
}

export function SkeletonCard() {
  return (
    <div style={{
      background: "#131929", border: "1px solid #1E2845", borderRadius: "12px",
      padding: "15px", marginBottom: "10px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div style={{ ...skeletonStyle, width: "70px", height: "20px", borderRadius: "20px" }} />
        <div style={{ display: "flex", gap: "6px" }}>
          <div style={{ ...skeletonStyle, width: "20px", height: "20px", borderRadius: "6px" }} />
          <div style={{ ...skeletonStyle, width: "20px", height: "20px", borderRadius: "6px" }} />
        </div>
      </div>
      <SkeletonLine width="40%" height={14} />
      <SkeletonLine width="80%" height={12} />
      <SkeletonLine width="60%" height={12} mb={0} />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <tr>
      <td style={{ padding: "11px 10px", borderBottom: "1px solid #1E2845" }}>
        <div style={{ ...skeletonStyle, width: "70%", height: "12px" }} />
      </td>
      <td style={{ padding: "11px 10px", borderBottom: "1px solid #1E2845" }}>
        <div style={{ ...skeletonStyle, width: "60%", height: "12px" }} />
      </td>
      <td style={{ padding: "11px 10px", borderBottom: "1px solid #1E2845" }}>
        <div style={{ ...skeletonStyle, width: "85%", height: "12px" }} />
      </td>
      <td style={{ width: "36px", borderBottom: "1px solid #1E2845" }} />
    </tr>
  );
}

export function SkeletonScreen({ rows = 4 }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0D0F1A", fontFamily: ff }}>
      <SkeletonStyles />
      <div style={{
        background: "#161D2E", borderBottom: "1px solid #1E2845", padding: "18px 20px 14px",
        textAlign: "center"
      }}>
        <div style={{ ...skeletonStyle, width: "180px", height: "16px", margin: "0 auto 8px" }} />
        <div style={{ ...skeletonStyle, width: "120px", height: "10px", margin: "0 auto" }} />
      </div>

      <div style={{ padding: "16px 14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", maxWidth: "480px", margin: "0 auto" }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              background: "#131929", border: "1px solid #1E2845", borderRadius: "14px",
              padding: "16px 8px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px"
            }}>
              <div style={{ ...skeletonStyle, width: "52px", height: "52px", borderRadius: "14px" }} />
              <div style={{ ...skeletonStyle, width: "60%", height: "10px" }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 14px 20px", maxWidth: "600px", margin: "0 auto" }}>
        <SkeletonLine width="40%" height={11} mb={14} />
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => <SkeletonTableRow key={i} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SkeletonOrderList({ count = 3 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <SkeletonStyles />
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function OfflineBanner({ online }) {
  if (online) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1100,
      background: "linear-gradient(135deg,#F59E0B,#EAB308)", color: "#1F2329",
      padding: "8px 16px", fontSize: "12px", fontWeight: 700,
      textAlign: "center", letterSpacing: ".4px",
      fontFamily: ff, boxShadow: "0 2px 12px rgba(0,0,0,.4)"
    }}>
      ⚠ You are offline — showing cached data
    </div>
  );
}
