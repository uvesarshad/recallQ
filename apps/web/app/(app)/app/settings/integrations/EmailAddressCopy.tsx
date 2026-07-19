"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { T, FONT, MONO } from "@recall/tokens";

export default function EmailAddressCopy({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 8px 8px 14px",
      borderRadius: 12,
      border: "1px solid " + T.line,
      background: "rgba(255,255,255,0.55)",
    }}>
      <code style={{ flex: 1, fontFamily: MONO, fontSize: 12.5, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {address}
      </code>
      <button
        onClick={copyToClipboard}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "6px 12px",
          borderRadius: 8,
          border: "none",
          background: copied
            ? "rgba(34,197,94,0.12)"
            : "linear-gradient(120deg," + T.azure + "," + T.mint + ")",
          color: copied ? "#16A34A" : "#fff",
          fontFamily: FONT,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          flexShrink: 0,
          transition: "background var(--duration-base) var(--ease-out), color var(--duration-base) var(--ease-out)",
        }}
      >
        {copied ? (
          <>
            <Check size={13} />
            Copied
          </>
        ) : (
          <>
            <Copy size={13} />
            Copy
          </>
        )}
      </button>
    </div>
  );
}
