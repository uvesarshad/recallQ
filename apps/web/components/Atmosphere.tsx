import React from "react";

export default function Atmosphere() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {/* Blob 1: azure, top-left */}
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(circle, #3D7DFF55 0%, transparent 70%)",
          top: -160,
          left: -120,
          filter: "blur(40px)",
          opacity: 0.4,
          animation: "f1 22s ease-in-out infinite",
        }}
      />
      {/* Blob 2: mint, bottom-right */}
      <div
        style={{
          position: "absolute",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: "radial-gradient(circle, #22C9A855 0%, transparent 70%)",
          bottom: -180,
          right: -100,
          filter: "blur(40px)",
          opacity: 0.4,
          animation: "f2 26s ease-in-out infinite",
        }}
      />
      {/* Blob 3: pale-azure, mid-right */}
      <div
        style={{
          position: "absolute",
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, #A8C4FF66 0%, transparent 70%)",
          top: "40%",
          right: "25%",
          filter: "blur(40px)",
          opacity: 0.4,
          animation: "f3 30s ease-in-out infinite",
        }}
      />
    </div>
  );
}
