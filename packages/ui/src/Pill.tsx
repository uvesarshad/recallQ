import React from "react";
import { T, FONT } from "@recall/tokens";

interface PillProps {
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  onClick?: () => void;
  accent?: boolean;
  active?: boolean;
}

export function Pill({ icon: Ic, label, onClick, accent, active }: PillProps) {
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const [reduce, setReduce] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const isHighlighted = accent || active;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        height: 34,
        padding: "0 12px",
        borderRadius: 10,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
        fontFamily: FONT,
        fontSize: 13,
        fontWeight: 600,
        color: isHighlighted ? "#fff" : T.inkSoft,
        background: isHighlighted
          ? "linear-gradient(120deg,#3D7DFF,#2B5FD9)"
          : hovered
          ? "#fff"
          : "rgba(255,255,255,0.6)",
        border: `1px solid ${isHighlighted ? "transparent" : T.glassEdge}`,
        boxShadow: isHighlighted ? "0 4px 12px rgba(61,125,255,0.28)" : "none",
        transform: !reduce && pressed ? "scale(0.97)" : "scale(1)",
        transition:
          "background 0.2s, transform var(--duration-fast) var(--ease-out)",
      }}
    >
      {Ic && <Ic size={15} color={isHighlighted ? "#fff" : T.inkSoft} />}
      {label}
    </button>
  );
}
