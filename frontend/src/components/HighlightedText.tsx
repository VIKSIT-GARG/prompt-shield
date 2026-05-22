"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info } from "lucide-react";

interface Segment {
  text: string;
  flagged: boolean;
  severity: string | null;
  reason: string | null;
}

interface Props {
  segments: Segment[];
  flaggedCount: number;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  critical: { bg: "rgba(239,68,68,0.18)",   border: "rgba(239,68,68,0.5)",   text: "#f87171", dot: "#ef4444" },
  high:     { bg: "rgba(245,158,11,0.18)",  border: "rgba(245,158,11,0.5)",  text: "#fbbf24", dot: "#f59e0b" },
  medium:   { bg: "rgba(251,191,36,0.14)",  border: "rgba(251,191,36,0.4)",  text: "#fcd34d", dot: "#fbbf24" },
  low:      { bg: "rgba(156,163,175,0.14)", border: "rgba(156,163,175,0.3)", text: "#9ca3af", dot: "#6b7280" },
};

export default function HighlightedText({ segments, flaggedCount }: Props) {
  const [tooltip, setTooltip] = useState<{ reason: string; severity: string; x: number; y: number } | null>(null);

  if (!segments || segments.length === 0) return null;

  return (
    <div className="relative">
      {flaggedCount > 0 && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg text-xs"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <AlertTriangle size={11} className="text-red-400 shrink-0" />
          <span style={{ color: "var(--text2)" }}>
            <span className="text-red-400 font-semibold font-mono">{flaggedCount}</span> suspicious span{flaggedCount !== 1 ? "s" : ""} detected — hover highlighted text for details
          </span>
        </div>
      )}

      <div className="text-sm leading-relaxed font-mono break-words whitespace-pre-wrap p-3 rounded-xl"
        style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)" }}>
        {segments.map((seg, i) => {
          if (!seg.flagged) return <span key={i}>{seg.text}</span>;
          const style = SEVERITY_STYLES[seg.severity || "low"];
          return (
            <span
              key={i}
              onMouseEnter={e => {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                setTooltip({ reason: seg.reason || "", severity: seg.severity || "low", x: rect.left, y: rect.bottom + 6 });
              }}
              onMouseLeave={() => setTooltip(null)}
              className="relative cursor-help rounded px-0.5 mx-px"
              style={{
                background: style.bg,
                borderBottom: `2px solid ${style.border}`,
                color: style.text,
                textDecoration: "underline",
                textDecorationColor: style.dot,
                textDecorationStyle: "wavy",
              }}
            >
              {seg.text}
              <span className="inline-block w-1.5 h-1.5 rounded-full ml-0.5 mb-0.5 align-middle"
                style={{ background: style.dot }} />
            </span>
          );
        })}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="fixed z-[999] max-w-xs px-3 py-2 rounded-xl text-xs shadow-xl pointer-events-none"
            style={{
              left: Math.min(tooltip.x, window.innerWidth - 260),
              top: tooltip.y,
              background: "var(--card)",
              border: `1px solid ${SEVERITY_STYLES[tooltip.severity]?.border || "var(--border)"}`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full shrink-0"
                style={{ background: SEVERITY_STYLES[tooltip.severity]?.dot }} />
              <span className="font-mono font-bold uppercase text-xs"
                style={{ color: SEVERITY_STYLES[tooltip.severity]?.text }}>
                {tooltip.severity}
              </span>
            </div>
            <p style={{ color: "var(--text2)" }}>{tooltip.reason}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      {flaggedCount > 0 && (
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {Object.entries(SEVERITY_STYLES).map(([sev, s]) => (
            <div key={sev} className="flex items-center gap-1 text-xs font-mono">
              <span className="w-2 h-2 rounded-full" style={{ background: s.dot }} />
              <span style={{ color: "var(--text3)" }}>{sev}</span>
            </div>
          ))}
          <span className="text-xs ml-auto flex items-center gap-1" style={{ color: "var(--text3)" }}>
            <Info size={10} /> hover to see reason
          </span>
        </div>
      )}
    </div>
  );
}
