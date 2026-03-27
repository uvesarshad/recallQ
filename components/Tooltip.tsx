"use client";

import React, { useState } from "react";
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

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

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
      {active && (
        <div
          className={cn(
            "pointer-events-none absolute z-[100] w-max max-w-[200px] rounded-buttons border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-2xl animate-in fade-in zoom-in-95 duration-150 ease-out",
            positionClasses[position],
            className
          )}
        >
          {content}
          <div
            className={cn(
              "absolute border-[6px]",
              arrowClasses[position]
            )}
          />
        </div>
      )}
    </div>
  );
}
