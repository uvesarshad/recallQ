import React from "react";
import { T } from "@recall/tokens";

interface ToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ on, onChange, disabled }: ToggleProps) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      aria-checked={on}
      role="switch"
      disabled={disabled}
      style={{
        width: 46,
        height: 27,
        borderRadius: 20,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        background: on
          ? "linear-gradient(120deg,#3D7DFF,#22C9A8)"
          : "rgba(11,18,32,0.15)",
        transition: "background 0.3s",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 22 : 3,
          width: 21,
          height: 21,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: T.shadowSoft,
          transition: "left 0.3s",
        }}
      />
    </button>
  );
}
