"use client";

import React from "react";

// ─── Topic definitions with colors matching Map.tsx palette ───────────────────
export const MAP_TOPICS = [
  { key: "POLITICS",    label: "Politics",    color: "#f43f5e", bg: "rgba(244,63,94,0.12)"  },
  { key: "GEOPOLITICS", label: "Geopolitics", color: "#e11d48", bg: "rgba(225,29,72,0.12)"  },
  { key: "ECONOMY",     label: "Economy",     color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  { key: "TECHNOLOGY",  label: "Technology",  color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  { key: "SPORTS",      label: "Sports",      color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  { key: "HEALTH",      label: "Health",      color: "#c084fc", bg: "rgba(192,132,252,0.12)"},
  { key: "WORLD",       label: "World",       color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
];

interface MapFilterPanelProps {
  events: { topic: string }[];
  activeTopic: string | null;
  onSelectTopic: (topic: string | null) => void;
}

export default function MapFilterPanel({ events, activeTopic, onSelectTopic }: MapFilterPanelProps) {
  // Only show topics that have at least one event
  const presentTopics = MAP_TOPICS.filter((t) =>
    events.some((e) => e.topic.toUpperCase().trim() === t.key)
  );

  // Count events per topic
  const countByTopic: Record<string, number> = {};
  events.forEach((e) => {
    const key = e.topic.toUpperCase().trim();
    countByTopic[key] = (countByTopic[key] || 0) + 1;
  });

  return (
    <div className="flex flex-col gap-2 w-[176px]">
      {/* Header label */}
      <div className="px-1 mb-1">
        <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-zinc-500 font-mono-data">
          Filters
        </span>
      </div>

      {/* All Categories pill */}
      <button
        onClick={() => onSelectTopic(null)}
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all duration-200"
        style={
          activeTopic === null
            ? {
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "#ffffff",
              }
            : {
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.5)",
              }
        }
      >
        {/* Dot */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: activeTopic === null ? "#ffffff" : "rgba(255,255,255,0.25)",
          }}
        />
        All Categories
      </button>

      {/* Per-topic pills */}
      {presentTopics.map((t) => {
        const isActive = activeTopic === t.key;
        const count = countByTopic[t.key] || 0;
        return (
          <button
            key={t.key}
            onClick={() => onSelectTopic(isActive ? null : t.key)}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all duration-200"
            style={
              isActive
                ? {
                    background: t.bg,
                    border: `1px solid ${t.color}55`,
                    color: t.color,
                  }
                : {
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.55)",
                  }
            }
          >
            {/* Color dot */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0 transition-all duration-200"
              style={{ background: isActive ? t.color : "rgba(255,255,255,0.2)" }}
            />
            <span className="flex-1 text-left">{t.label}</span>
            {/* Count badge */}
            {count > 0 && (
              <span
                className="text-[9px] font-bold font-mono-data px-1.5 py-0.5 rounded-full"
                style={{
                  background: isActive ? `${t.color}22` : "rgba(255,255,255,0.06)",
                  color: isActive ? t.color : "rgba(255,255,255,0.3)",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
