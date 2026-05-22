"use client";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ShieldAlert, ShieldX, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const LEVEL = {
  safe:       { color: "#10b981", Icon: ShieldCheck, label: "SAFE",       glow: "glow-safe" },
  suspicious: { color: "#f59e0b", Icon: ShieldAlert, label: "SUSPICIOUS", glow: "glow-suspicious" },
  malicious:  { color: "#ef4444", Icon: ShieldX,     label: "MALICIOUS",  glow: "glow-malicious" },
};

const COMP_LABELS: Record<string,string> = {
  ml_prediction: "ML Model",
  semantic_similarity: "Semantic Match",
  keyword_anomaly: "Keyword Scan",
  instruction_chaining: "Chain Detection",
  entropy_anomaly: "Entropy Check",
};
const COMP_W: Record<string,number> = {
  ml_prediction:0.45, semantic_similarity:0.25, keyword_anomaly:0.15, instruction_chaining:0.10, entropy_anomaly:0.05,
};

export default function RiskScore({ result, compact=false }: { result: any; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const cfg = LEVEL[result.risk_level as keyof typeof LEVEL] || LEVEL.safe;
  const { Icon } = cfg;
  const circ = 2 * Math.PI * 36;
  const dash = circ * (1 - result.risk_score);

  return (
    <div className={`rounded-2xl overflow-hidden ${cfg.glow}`} style={{ background:"var(--card)", border:`1px solid ${cfg.color}22` }}>
      <div className="flex items-center gap-3 p-3.5">
        {/* Ring */}
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="36" fill="none" stroke="var(--bg3)" strokeWidth="7"/>
            <motion.circle cx="40" cy="40" r="36" fill="none" stroke={cfg.color} strokeWidth="7"
              strokeLinecap="round" strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: dash }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-base font-bold" style={{ color: cfg.color }}>
              {Math.round(result.risk_score * 100)}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon size={14} style={{ color: cfg.color }} />
            <span className="font-mono text-xs font-bold tracking-widest" style={{ color: cfg.color }}>{cfg.label}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ fontFamily:"var(--font-mono)", color:"var(--text2)" }}>
            <span>Decision:</span>
            <span className="font-semibold" style={{ color: result.is_injection ? "#ef4444" : "#10b981" }}>{result.decision}</span>
          </div>
          <div className="text-xs mt-0.5" style={{ fontFamily:"var(--font-mono)", color:"var(--text3)", fontSize:"10px" }}>
            {result.processing_time_ms}ms · score {result.risk_score?.toFixed(4)}
          </div>
        </div>

        <button onClick={() => setOpen(!open)} className="p-1 rounded-lg transition-colors" style={{ color:"var(--text3)" }}>
          {open ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
        </button>
      </div>

      <AnimatePresence>
        {open && result.components && (
          <motion.div initial={{ height:0,opacity:0 }} animate={{ height:"auto",opacity:1 }} exit={{ height:0,opacity:0 }}
            className="px-3.5 pb-3.5 pt-2 space-y-2" style={{ borderTop:"1px solid var(--border)" }}>
            <p className="text-xs font-mono uppercase tracking-widest mb-2.5" style={{ color:"var(--text3)", fontSize:"10px" }}>Score Breakdown</p>
            {Object.entries(result.components).map(([k, v]) => (
              <div key={k} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color:"var(--text2)" }}>{COMP_LABELS[k]||k}</span>
                  <div className="flex items-center gap-2">
                    <span style={{ color:"var(--text3)", fontFamily:"var(--font-mono)", fontSize:"10px" }}>×{COMP_W[k]?.toFixed(2)}</span>
                    <span className="font-mono font-semibold" style={{ color:"var(--text)" }}>{((v as number)*100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background:"var(--bg3)" }}>
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: cfg.color, opacity: 0.75 }}
                    initial={{ width:0 }}
                    animate={{ width:`${(v as number)*100}%` }}
                    transition={{ duration:0.7, ease:"easeOut", delay:0.05 }}
                  />
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
