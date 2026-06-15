"use client";

import React, { useState, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Search,
  ArrowUpDown,
  Filter,
  Folder,
  Globe,
  Tag,
  CheckSquare,
  FolderPlus,
  SlidersHorizontal,
} from "lucide-react";
import { Pill } from "@recall/ui";
import { T, FONT, MONO } from "@recall/tokens";

// Lucide icons have size?: string | number but Pill expects size?: number.
// Wrap to narrow the type without changing runtime behavior.
function pillIcon(
  Icon: LucideIcon,
): React.ComponentType<{ size?: number; color?: string }> {
  const W = ({ size, color }: { size?: number; color?: string }) => (
    <Icon size={size} color={color} />
  );
  W.displayName = `Pill(${Icon.displayName ?? Icon.name})`;
  return W;
}

interface ControlBarProps {
  cols: number;
  setCols: (n: number) => void;
  query: string;
  setQuery: (q: string) => void;
  sort: string;
  setSort: (s: string) => void;
  folder: string;
  setFolder: (f: string) => void;
  source: string;
  setSource: (s: string) => void;
  itemType: string;
  setItemType: (t: string) => void;
  selectionMode: boolean;
  setSelectionMode: (v: boolean) => void;
  onAddFolder?: () => void;
  folders?: Array<{ id: string; name: string }>;
}

const SORT_CYCLE: string[] = ["newest", "oldest", "title"];

export function ControlBar({
  cols,
  setCols,
  query,
  setQuery,
  sort,
  setSort,
  folder,
  setFolder,
  source,
  setSource,
  itemType,
  setItemType,
  selectionMode,
  setSelectionMode,
  onAddFolder,
  folders,
}: ControlBarProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function cycleSort() {
    const idx = SORT_CYCLE.indexOf(sort);
    setSort(SORT_CYCLE[(idx + 1) % SORT_CYCLE.length] ?? "newest");
  }

  const sortLabel =
    sort === "oldest" ? "Oldest" : sort === "title" ? "A–Z" : "Newest";

  const activeFolderName =
    folder && folders
      ? (folders.find((f) => f.id === folder)?.name ?? "Folder")
      : "Folder";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "10px 4px",
        alignItems: "center",
      }}
    >
      {/* Search input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          minWidth: 180,
          flex: "0 1 240px",
          height: 34,
          borderRadius: 10,
          background: "rgba(255,255,255,.6)",
          border: `1px solid ${searchFocused ? T.azure : T.glassEdge}`,
          padding: "0 10px",
          boxSizing: "border-box",
          transition: "border-color 0.15s",
        }}
      >
        <Search size={14} color={T.inkFaint} style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search by meaning…"
          style={{
            flex: 1,
            fontFamily: FONT,
            fontSize: 13,
            color: T.ink,
            background: "transparent",
            border: "none",
            outline: "none",
            minWidth: 0,
          }}
        />
      </div>

      {/* Pill controls */}
      <Pill
        icon={pillIcon(ArrowUpDown)}
        label={sortLabel}
        onClick={cycleSort}
        active={sort !== "newest"}
      />

      <Pill
        icon={pillIcon(Filter)}
        label="Filter"
        active={source !== "" || itemType !== ""}
      />

      <Pill
        icon={pillIcon(Folder)}
        label={folder ? activeFolderName : "Folder"}
        onClick={() => {
          if (folder) setFolder("");
        }}
        active={folder !== ""}
      />

      <Pill
        icon={pillIcon(Globe)}
        label={source || "Source"}
        onClick={() => {
          if (source) setSource("");
        }}
        active={source !== ""}
      />

      <Pill
        icon={pillIcon(Tag)}
        label={itemType || "Type"}
        onClick={() => {
          if (itemType) setItemType("");
        }}
        active={itemType !== ""}
      />

      <Pill
        icon={pillIcon(CheckSquare)}
        label="Select"
        onClick={() => setSelectionMode(!selectionMode)}
        accent={selectionMode}
      />

      <Pill
        icon={pillIcon(FolderPlus)}
        label="Add Folder"
        onClick={onAddFolder}
        accent
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Column slider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 34,
          padding: "0 12px",
          borderRadius: 10,
          background: "rgba(255,255,255,.6)",
          border: `1px solid ${T.glassEdge}`,
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        <SlidersHorizontal size={15} color={T.inkFaint} style={{ flexShrink: 0 }} />
        <input
          type="range"
          min={2}
          max={6}
          value={cols}
          onChange={(e) => setCols(Number(e.target.value))}
          style={{
            width: 90,
            accentColor: T.azure,
            cursor: "pointer",
          }}
        />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 12,
            color: T.inkFaint,
            minWidth: 12,
            textAlign: "center",
          }}
        >
          {cols}
        </span>
      </div>
    </div>
  );
}

export default ControlBar;
