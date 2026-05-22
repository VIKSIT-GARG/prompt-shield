"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LINES = [
  "Initializing security kernel…",
  "Loading injection detection model…",
  "Calibrating risk scoring engine…",
  "Activating semantic analysis…",
  "Establishing secure gateway…",
  "PromptShield online.",
];

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [line, setLine] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i++;
      setLine(i);
      if (i >= LINES.length) {
        clearInterval(t);
        setTimeout(() => setDone(true), 500);
        setTimeout(() => onComplete(), 950);
      }
    }, 300);
    return () => clearInterval(t);
  }, [onComplete]);

  const pct = Math.round((line / LINES.length) * 100);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.45 }}
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#070b12] overflow-hidden"
        >
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: `linear-gradient(rgba(14,165,233,1) 1px,transparent 1px),linear-gradient(90deg,rgba(14,165,233,1) 1px,transparent 1px)`,
            backgroundSize: "48px 48px",
          }} />
          {/* Glow */}
          <div className="absolute inset-0" style={{
            background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(14,165,233,0.06) 0%, transparent 70%)"
          }} />

          {/* Shield */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "backOut" }}
            className="relative mb-10"
          >
            {[1.5, 2.0].map((s, i) => (
              <motion.div key={i}
                animate={{ scale: [1,s,1], opacity: [0.25,0,0.25] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-sky-500/15 scale-150"
              />
            ))}
            <svg viewBox="0 0 100 100" className="relative w-20 h-20">
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38bdf8"/>
                  <stop offset="100%" stopColor="#818cf8"/>
                </linearGradient>
                <linearGradient id="sf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.12"/>
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.04"/>
                </linearGradient>
              </defs>
              <motion.path d="M50 8 L85 22 L85 50 C85 70 65 85 50 92 C35 85 15 70 15 50 L15 22 Z"
                fill="url(#sf)" stroke="url(#sg)" strokeWidth="2.5" strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
              />
              <motion.path d="M33 50 L44 62 L67 38" fill="none" stroke="#0ea5e9" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.9, duration: 0.45 }}
              />
            </svg>
          </motion.div>

          {/* Title */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center mb-8">
            <h1 className="font-display text-4xl font-normal text-white tracking-tight mb-1">PromptShield</h1>
            <p className="text-xs text-slate-500 font-mono tracking-[0.2em] uppercase">AI Security Gateway</p>
          </motion.div>

          {/* Boot log */}
          <div className="w-72 space-y-1.5 mb-7">
            {LINES.slice(0, line).map((l, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }}
                className={`flex items-center gap-2 text-xs font-mono ${i === line-1 ? "text-sky-400" : "text-slate-600"}`}>
                <span>{i === line-1 ? "›" : "✓"}</span>{l}
              </motion.div>
            ))}
          </div>

          {/* Progress */}
          <div className="w-72">
            <div className="h-px bg-white/5 rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full"
                animate={{ width: `${pct}%` }} transition={{ duration: 0.25 }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs font-mono text-slate-700">v1.0.0</span>
              <span className="text-xs font-mono text-slate-600">{pct}%</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
