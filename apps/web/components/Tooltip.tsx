"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export default function Tooltip({
  content,
  children,
  position = "top",
  className,
}: TooltipProps) {
  const [active, setActive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Placement only — the centering translate is folded into the animated
  // inline `transform` below so it doesn't get overridden.
  const positionClasses = {
    top: "bottom-full left-1/2 mb-2",
    bottom: "top-full left-1/2 mt-2",
    left: "right-full top-1/2 mr-2",
    right: "left-full top-1/2 ml-2",
  };

  // Scale from the edge nearest the trigger.
  const transformOrigin = {
    top: "bottom center",
    bottom: "top center",
    left: "right center",
    right: "left center",
  } as const;

  // Resting (shown) transform — keeps the centering translate, no offset/scale.
  const shownTransform = {
    top: "translateX(-50%) translateY(0px) scale(1)",
    bottom: "translateX(-50%) translateY(0px) scale(1)",
    left: "translateX(0px) translateY(-50%) scale(1)",
    right: "translateX(0px) translateY(-50%) scale(1)",
  } as const;

  // Hidden transform — offset slightly toward the trigger + tiny scale down.
  const hiddenTransform = {
    top: "translateX(-50%) translateY(4px) scale(0.97)",
    bottom: "translateX(-50%) translateY(-4px) scale(0.97)",
    left: "translateX(4px) translateY(-50%) scale(0.97)",
    right: "translateX(-4px) translateY(-50%) scale(0.97)",
  } as const;

  // Reduced motion: opacity only, keep centering translate but no scale/offset.
  const staticTransform = {
    top: "translateX(-50%)",
    bottom: "translateX(-50%)",
    left: "translateY(-50%)",
    right: "translateY(-50%)",
  } as const;

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-surface border-x-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-surface border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-surface border-y-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-surface border-y-transparent border-l-transparent",
  };

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      {children}
      <div
        role="tooltip"
        aria-hidden={!active}
        className={cn(
          "pointer-events-none absolute z-[100] w-max max-w-[200px] rounded-buttons border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-2xl",
          positionClasses[position],
          className
        )}
        style={{
          transformOrigin: transformOrigin[position],
          opacity: active ? 1 : 0,
          transform: reducedMotion
            ? staticTransform[position]
            : active
            ? shownTransform[position]
            : hiddenTransform[position],
          transition: reducedMotion
            ? "opacity var(--duration-fast) var(--ease-out)"
            : "opacity var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out)",
        }}
      >
        {content}
        <div
          className={cn(
            "absolute border-[6px]",
            arrowClasses[position]
          )}
        />
      </div>
    </div>
  );
}
