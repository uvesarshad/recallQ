import React from "react";
import { T, MONO } from "@recall/tokens";

export function TagBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 10.5,
        fontWeight: 500,
        color: T.azureDeep,
        background: "rgba(61,125,255,0.1)",
        padding: "3px 7px",
        borderRadius: 6,
        letterSpacing: ".2px",
        display: "inline-block",
      }}
    >
      #{children}
    </span>
  );
}
