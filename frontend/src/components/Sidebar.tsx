"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, MessageSquare, ShieldCheck, ShieldAlert, ShieldX, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { getAllSessions, deleteSession, clearAllSessions, formatRelativeTime, ChatSession } from "@/lib/history";

interface Props {
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  refreshTrigger: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ currentSessionId, onSelectSession, onNewChat, refreshTrigger, collapsed, onToggleCollapse }: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [search, setSearch] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => { setSessions(getAllSessions()); }, [refreshTrigger, currentSessionId]);

  const filtered = sessions.filter(s => s.title.toLowerCase().includes(search.toLowerCase()));

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSession(id);
    setSessions(getAllSessions());
    if (id === currentSessionId) onNewChat();
  };

  const handleClear = () => {
    if (confirmClear) { clearAllSessions(); setSessions([]); onNewChat(); setConfirmClear(false); }
    else { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); }
  };

  return (
    <div className="relative flex flex-col h-full" style={{ background: "var(--bg2)", borderRight: "1px solid var(--border)" }}>
      {/* Collapse toggle — always visible */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3.5 top-5 z-20 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-colors"
        style={{ background: "var(--card)", border: "1px solid var(--border2)", color: "var(--text2)" }}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {/* Collapsed state */}
      {collapsed ? (
        <div className="flex flex-col items-center pt-12 gap-2 px-2 w-14">
          <button onClick={onNewChat}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
            title="New Chat">
            <Plus size={15} />
          </button>
          <div className="w-6 h-px my-1" style={{ background: "var(--border)" }} />
          {sessions.slice(0, 8).map(s => (
            <button key={s.id} onClick={() => onSelectSession(s.id)} title={s.title}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: s.id === currentSessionId ? "var(--accent-dim)" : "transparent",
                color: s.id === currentSessionId ? "var(--accent)" : "var(--text3)",
              }}>
              <MessageSquare size={13} />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col h-full w-60">
          {/* Header */}
          <div className="p-3 pt-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <button onClick={onNewChat}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(14,165,233,0.2)" }}>
              <Plus size={14} /> New Chat
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: "var(--bg3)" }}>
              <Search size={11} style={{ color: "var(--text3)" }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search chats…"
                className="flex-1 bg-transparent text-xs outline-none"
                style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }} />
            </div>
          </div>

          {/* Sessions */}
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 text-center">
                <MessageSquare size={18} style={{ color: "var(--text3)" }} className="mb-2 opacity-40" />
                <p className="text-xs" style={{ color: "var(--text3)" }}>
                  {search ? "No matching chats" : "No chat history yet"}
                </p>
              </div>
            ) : filtered.map(s => (
              <SessionItem key={s.id} session={s} active={s.id === currentSessionId}
                onClick={() => onSelectSession(s.id)} onDelete={handleDelete} />
            ))}
          </div>

          {/* Footer */}
          {sessions.length > 0 && (
            <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between text-xs mb-2" style={{ color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                <span>{sessions.length} chats</span>
                <span>{sessions.reduce((a,s) => a + s.stats.malicious, 0)} blocked total</span>
              </div>
              <button onClick={handleClear}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={{
                  color: confirmClear ? "#ef4444" : "var(--text3)",
                  background: confirmClear ? "rgba(239,68,68,0.08)" : "transparent",
                  border: confirmClear ? "1px solid rgba(239,68,68,0.2)" : "1px solid transparent",
                }}>
                <Trash2 size={11} />
                {confirmClear ? "Confirm — clear all?" : `Clear all (${sessions.length})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionItem({ session, active, onClick, onDelete }: {
  session: ChatSession; active: boolean;
  onClick: () => void; onDelete: (e: React.MouseEvent, id: string) => void;
}) {
  return (
    <div onClick={onClick}
      className="group relative flex items-start gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all"
      style={{
        background: active ? "var(--accent-dim)" : "transparent",
        border: active ? "1px solid rgba(14,165,233,0.18)" : "1px solid transparent",
      }}
    >
      <div className="mt-0.5 w-5 h-5 rounded-md shrink-0 flex items-center justify-center" style={{ background: "var(--bg3)" }}>
        <MessageSquare size={10} style={{ color: active ? "var(--accent)" : "var(--text3)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: active ? "var(--text)" : "var(--text2)" }}>{session.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs" style={{ color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "10px" }}>
            {formatRelativeTime(session.updatedAt)}
          </span>
          <div className="flex items-center gap-1">
            {session.stats.malicious > 0 && <span className="flex items-center gap-0.5 text-red-500" style={{ fontSize:"10px", fontFamily:"var(--font-mono)" }}><ShieldX size={8}/>{session.stats.malicious}</span>}
            {session.stats.suspicious > 0 && <span className="flex items-center gap-0.5 text-amber-500" style={{ fontSize:"10px", fontFamily:"var(--font-mono)" }}><ShieldAlert size={8}/>{session.stats.suspicious}</span>}
            {session.stats.safe > 0 && <span className="flex items-center gap-0.5 text-emerald-500" style={{ fontSize:"10px", fontFamily:"var(--font-mono)" }}><ShieldCheck size={8}/>{session.stats.safe}</span>}
          </div>
        </div>
      </div>
      <button onClick={e => onDelete(e, session.id)}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center transition-all shrink-0"
        style={{ color: "var(--text3)" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}>
        <Trash2 size={10} />
      </button>
    </div>
  );
}
