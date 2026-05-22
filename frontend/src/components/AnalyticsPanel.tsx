"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart2, ShieldX, ShieldCheck, ShieldAlert, Clock, Zap,
  RefreshCw, Filter, FileText, Image, MessageSquare, Download, ChevronDown, ChevronUp
} from "lucide-react";
import { getStats, getLogs } from "@/lib/api";

const LEVEL_STYLE = {
  safe:       { color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.2)",  label: "SAFE" },
  suspicious: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.2)",  label: "SUSPICIOUS" },
  malicious:  { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.2)",   label: "MALICIOUS" },
};

function StatCard({ label, value, sub, color, icon }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--text3)" }}>{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + "18" }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <div className="font-display text-3xl font-normal" style={{ color: "var(--text)" }}>{value}</div>
      {sub && <div className="text-xs font-mono" style={{ color: "var(--text3)" }}>{sub}</div>}
    </motion.div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg3)" }}>
      <motion.div className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: max > 0 ? `${(value / max) * 100}%` : "0%" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

function Timeline({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map((d: any) => d.total || 0), 1);
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "var(--text3)" }}>Last 14 Days</p>
      <div className="flex items-end gap-1 h-28">
        {data.map((d: any, i: number) => {
          const total = d.total || 0;
          const barH = maxVal > 0 ? (total / maxVal) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="w-full flex flex-col justify-end rounded-t-sm overflow-hidden" style={{ height: "96px" }}>
                <motion.div initial={{ height: 0 }} animate={{ height: `${barH}%` }}
                  transition={{ duration: 0.5, delay: i * 0.03, ease: "easeOut" }}
                  className="w-full rounded-t-sm"
                  style={{
                    background: d.malicious > 0 ? "#ef4444"
                      : d.suspicious > 0 ? "#f59e0b" : "#10b981",
                    opacity: 0.8,
                  }}
                />
              </div>
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                <div className="px-2 py-1 rounded-lg text-xs font-mono whitespace-nowrap"
                  style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text2)" }}>
                  {d.label}: {total}
                </div>
              </div>
              {i % 3 === 0 && (
                <span className="text-xs rotate-0 whitespace-nowrap" style={{ color: "var(--text3)", fontSize: "9px", fontFamily: "var(--font-mono)" }}>
                  {d.label?.slice(4)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LogRow({ log, expanded, onClick }: { log: any; expanded: boolean; onClick: () => void }) {
  const style = LEVEL_STYLE[log.risk_level as keyof typeof LEVEL_STYLE] || LEVEL_STYLE.safe;
  const sourceIcon = log.source === "file" ? <FileText size={10} /> : log.source === "image" ? <Image size={10} /> : <MessageSquare size={10} />;

  return (
    <div className="rounded-xl overflow-hidden transition-all" style={{ border: "1px solid var(--border)" }}>
      <div onClick={onClick}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
        style={{ background: "var(--card)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg3)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--card)")}
      >
        {/* Time */}
        <span className="text-xs font-mono shrink-0 w-16" style={{ color: "var(--text3)", fontSize: "10px" }}>
          {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>

        {/* Level badge */}
        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md shrink-0"
          style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}`, fontSize: "9px" }}>
          {style.label}
        </span>

        {/* Source */}
        <span className="flex items-center gap-1 text-xs font-mono shrink-0" style={{ color: "var(--text3)", fontSize: "10px" }}>
          {sourceIcon} {log.source}
        </span>

        {/* Score */}
        <span className="text-xs font-mono font-semibold shrink-0"
          style={{ color: style.color, fontSize: "11px" }}>
          {(log.risk_score * 100).toFixed(0)}
        </span>

        {/* Preview */}
        <span className="flex-1 text-xs truncate font-mono min-w-0" style={{ color: "var(--text2)", fontSize: "11px" }}>
          {log.text_preview}
        </span>

        {/* Flags */}
        {log.flagged_count > 0 && (
          <span className="text-xs font-mono shrink-0 px-1.5 py-0.5 rounded"
            style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: "9px" }}>
            {log.flagged_count} flags
          </span>
        )}

        {/* Time */}
        <span className="text-xs font-mono shrink-0" style={{ color: "var(--text3)", fontSize: "10px" }}>
          {log.processing_time_ms}ms
        </span>

        {expanded ? <ChevronUp size={12} style={{ color: "var(--text3)" }} /> : <ChevronDown size={12} style={{ color: "var(--text3)" }} />}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden" style={{ borderTop: "1px solid var(--border)", background: "var(--bg3)" }}>
            <div className="px-4 py-3 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ["Decision", log.decision],
                  ["Provider", log.provider || "—"],
                  ["Score", log.risk_score?.toFixed(4)],
                  ["Time", `${log.processing_time_ms}ms`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg px-2 py-1.5" style={{ background: "var(--card)" }}>
                    <p className="text-xs font-mono" style={{ color: "var(--text3)", fontSize: "9px" }}>{k}</p>
                    <p className="text-xs font-mono font-semibold mt-0.5" style={{ color: "var(--text)" }}>{v}</p>
                  </div>
                ))}
              </div>
              {log.components && (
                <div className="space-y-1.5 pt-1">
                  {Object.entries(log.components).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-3">
                      <span className="text-xs font-mono w-40 shrink-0" style={{ color: "var(--text3)", fontSize: "10px" }}>
                        {k.replace(/_/g, " ")}
                      </span>
                      <div className="flex-1">
                        <MiniBar value={v as number} max={1} color={style.color} />
                      </div>
                      <span className="text-xs font-mono w-8 text-right shrink-0" style={{ color: "var(--text2)", fontSize: "10px" }}>
                        {((v as number) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs font-mono break-all pt-1" style={{ color: "var(--text3)", fontSize: "10px" }}>
                {log.text_preview}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AnalyticsPanel() {
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard"|"logs">("dashboard");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [expandedLog, setExpandedLog] = useState<string|null>(null);
  const [logPage, setLogPage] = useState(0);
  const PAGE = 50;

  const loadStats = useCallback(async () => {
    try { setStats(await getStats()); } catch {}
    finally { setLoading(false); }
  }, []);

  const loadLogs = useCallback(async (page = 0, filter = "all") => {
    setLogsLoading(true);
    try {
      const res = await getLogs(PAGE, page * PAGE, filter === "all" ? undefined : filter);
      setLogs(res.logs || []);
    } catch {}
    finally { setLogsLoading(false); }
  }, []);

  useEffect(() => { loadStats(); loadLogs(0, levelFilter); }, []);

  const handleFilterChange = (f: string) => {
    setLevelFilter(f); setLogPage(0); loadLogs(0, f);
  };

  const exportLogs = () => {
    const csv = ["timestamp,level,score,decision,source,time_ms,preview",
      ...logs.map(l => `${l.timestamp},${l.risk_level},${l.risk_score},${l.decision},${l.source},${l.processing_time_ms},"${l.text_preview?.replace(/"/g, "'")}"`)
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `promptshield_logs_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-normal" style={{ color: "var(--text)" }}>Analytics</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text3)" }}>Real-time scan telemetry and threat intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sub-tabs */}
          <div className="flex gap-0.5 p-1 rounded-xl" style={{ background: "var(--bg3)" }}>
            {(["dashboard","logs"] as const).map(t => (
              <button key={t} onClick={() => { setActiveTab(t); if(t==="logs") loadLogs(logPage, levelFilter); }}
                className="px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
                style={{
                  background: activeTab===t ? "var(--card)" : "transparent",
                  color: activeTab===t ? "var(--text)" : "var(--text3)",
                  boxShadow: activeTab===t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}>
                {t === "dashboard" ? <span className="flex items-center gap-1.5"><BarChart2 size={11}/>{t}</span>
                  : <span className="flex items-center gap-1.5"><Filter size={11}/>{t}</span>}
              </button>
            ))}
          </div>
          <button onClick={() => { loadStats(); loadLogs(logPage, levelFilter); }}
            className="p-2 rounded-xl transition-colors"
            style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text3)" }}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "dashboard" ? (
          <motion.div key="dash" initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}
            transition={{ duration: 0.15 }} className="space-y-4">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_,i) => (
                  <div key={i} className="rounded-2xl p-4 h-28 animate-pulse" style={{ background: "var(--card)" }} />
                ))}
              </div>
            ) : stats ? (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Total Scans"  value={stats.total}    sub={`${stats.avg_time_ms}ms avg`} color="#0ea5e9" icon={<BarChart2 size={14}/>}/>
                  <StatCard label="Blocked"      value={stats.blocked}  sub={`${stats.block_rate}% block rate`} color="#ef4444" icon={<ShieldX size={14}/>}/>
                  <StatCard label="Suspicious"   value={stats.by_level?.suspicious||0} sub="flagged, allowed" color="#f59e0b" icon={<ShieldAlert size={14}/>}/>
                  <StatCard label="Avg Score"    value={(stats.avg_score*100).toFixed(1)} sub="out of 100" color="#10b981" icon={<ShieldCheck size={14}/>}/>
                </div>

                {/* Timeline */}
                <Timeline data={stats.timeline} />

                {/* Bottom row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* By source */}
                  <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "var(--text3)" }}>By Source</p>
                    <div className="space-y-3">
                      {Object.entries(stats.by_source || {}).map(([src, cnt]) => {
                        const total = stats.total || 1;
                        const pct = Math.round((cnt as number) / total * 100);
                        return (
                          <div key={src} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="capitalize flex items-center gap-1.5" style={{ color: "var(--text2)" }}>
                                {src === "file" ? <FileText size={11}/> : src === "image" ? <Image size={11}/> : <MessageSquare size={11}/>}
                                {src}
                              </span>
                              <span style={{ color: "var(--text3)" }}>{cnt as number} ({pct}%)</span>
                            </div>
                            <MiniBar value={cnt as number} max={total} color="#0ea5e9" />
                          </div>
                        );
                      })}
                      {Object.keys(stats.by_source || {}).length === 0 && (
                        <p className="text-xs font-mono text-center py-4" style={{ color: "var(--text3)" }}>No data yet</p>
                      )}
                    </div>
                  </div>

                  {/* Hourly heatmap */}
                  <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "var(--text3)" }}>24h Activity</p>
                    <div className="grid grid-cols-12 gap-1">
                      {(stats.hourly || []).map((h: any) => {
                        const maxH = Math.max(...(stats.hourly||[]).map((x:any)=>x.count), 1);
                        const intensity = maxH > 0 ? h.count / maxH : 0;
                        return (
                          <div key={h.hour} className="group relative">
                            <div className="w-full aspect-square rounded-sm transition-all"
                              style={{
                                background: h.count > 0 ? `rgba(14,165,233,${0.1 + intensity * 0.7})` : "var(--bg3)",
                                border: `1px solid var(--border)`,
                              }} />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                              <div className="px-1.5 py-1 rounded text-xs font-mono whitespace-nowrap"
                                style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text2)", fontSize: "10px" }}>
                                {h.hour}:00 — {h.count}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-xs font-mono" style={{ color: "var(--text3)", fontSize: "9px" }}>12am</span>
                      <span className="text-xs font-mono" style={{ color: "var(--text3)", fontSize: "9px" }}>12pm</span>
                      <span className="text-xs font-mono" style={{ color: "var(--text3)", fontSize: "9px" }}>11pm</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20" style={{ color: "var(--text3)" }}>
                <BarChart2 size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No stats available. Make sure the backend is running.</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="logs" initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}
            transition={{ duration: 0.15 }} className="space-y-3">
            {/* Logs toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg3)" }}>
                {(["all","safe","suspicious","malicious"]).map(f => (
                  <button key={f} onClick={() => handleFilterChange(f)}
                    className="px-3 py-1 rounded-lg text-xs font-mono capitalize transition-colors"
                    style={{
                      background: levelFilter===f ? "var(--card)" : "transparent",
                      color: levelFilter===f ? "var(--text)" : "var(--text3)",
                    }}>
                    {f}
                  </button>
                ))}
              </div>
              <span className="text-xs font-mono ml-2" style={{ color: "var(--text3)" }}>
                {logs.length} entries
              </span>
              <button onClick={exportLogs}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)" }}>
                <Download size={11} /> Export CSV
              </button>
            </div>

            {/* Column headers */}
            <div className="flex items-center gap-3 px-4 py-1.5 text-xs font-mono" style={{ color: "var(--text3)", fontSize: "10px" }}>
              <span className="w-16 shrink-0">Time</span>
              <span className="w-20 shrink-0">Level</span>
              <span className="w-14 shrink-0">Source</span>
              <span className="w-8 shrink-0">Score</span>
              <span className="flex-1">Preview</span>
              <span className="w-14 shrink-0">Flags</span>
              <span className="w-12 shrink-0">Speed</span>
              <span className="w-4 shrink-0" />
            </div>

            {logsLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_,i) => (
                  <div key={i} className="rounded-xl h-12 animate-pulse" style={{ background: "var(--card)" }} />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-20" style={{ color: "var(--text3)" }}>
                <Filter size={28} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No scan logs yet. Start chatting or scanning files.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {logs.map(log => (
                  <LogRow key={log.id} log={log}
                    expanded={expandedLog === log.id}
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {logs.length === PAGE && (
              <div className="flex justify-center">
                <button onClick={() => { const next = logPage+1; setLogPage(next); loadLogs(next, levelFilter); }}
                  className="px-4 py-2 rounded-xl text-xs font-medium transition-colors"
                  style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)" }}>
                  Load more
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
