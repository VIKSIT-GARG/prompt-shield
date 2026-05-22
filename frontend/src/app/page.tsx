"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ScanLine, MessageSquare, Sun, Moon, Key, Eye, EyeOff, Zap, Plus, Menu, X, BarChart2 } from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";
import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";
import ScanPanel from "@/components/ScanPanel";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import { ChatSession, createNewSession, getSession, getAllSessions } from "@/lib/history";

function hint(k:string):string {
  if(!k)return"";
  if(k.startsWith("sk-ant-"))return"Anthropic";if(k.startsWith("sk-or-"))return"OpenRouter";
  if(k.startsWith("sk-"))return"OpenAI";if(k.startsWith("AIza"))return"Gemini";
  if(k.startsWith("gsk_"))return"Groq";
  if(k.length===32&&/^[0-9a-fA-F]+$/.test(k))return"Mistral";
  if(k.length>=36)return"Cohere";return"Unknown";
}
const PC:Record<string,string>={
  Gemini:"#3b82f6",OpenAI:"#10b981",Anthropic:"#f97316",
  Groq:"#a855f7",Mistral:"#ec4899",Cohere:"#06b6d4",OpenRouter:"#eab308",
};

const TABS = [
  { id:"chat",     Icon:MessageSquare, label:"Chat"      },
  { id:"scan",     Icon:ScanLine,      label:"Scan"      },
  { id:"analytics",Icon:BarChart2,     label:"Analytics" },
] as const;
type Tab = typeof TABS[number]["id"];

export default function Home() {
  const [loaded,setLoaded]=useState(false);
  const [dark,setDark]=useState(true);
  const [tab,setTab]=useState<Tab>("chat");
  const [session,setSession]=useState<ChatSession|null>(null);
  const [apiKey,setApiKey]=useState("");
  const [showKey,setShowKey]=useState(false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [mobileSidebar,setMobileSidebar]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const [counts,setCounts]=useState({safe:0,suspicious:0,malicious:0});

  useEffect(()=>{document.documentElement.classList.toggle("dark",dark);},[dark]);
  useEffect(()=>{const k=sessionStorage.getItem("ps_key")||"";if(k)setApiKey(k);},[]);
  const updateKey=(k:string)=>{setApiKey(k);sessionStorage.setItem("ps_key",k);};

  const newChat=useCallback(()=>{const s=createNewSession();setSession(s);setRefresh(n=>n+1);setMobileSidebar(false);},[]);
  const selectSession=useCallback((id:string)=>{const s=getSession(id);if(s){setSession(s);setTab("chat");}setMobileSidebar(false);},[]);
  const onSessionUpdate=useCallback((s:ChatSession)=>{setSession(s);setRefresh(n=>n+1);},[]);
  const onScan=useCallback((level:string)=>{setCounts(prev=>({...prev,[level]:prev[level as keyof typeof prev]+1}));},[]);
  const handleLoaded=useCallback(()=>{setLoaded(true);const sessions=getAllSessions();setSession(sessions.length>0?sessions[0]:createNewSession());},[]);

  const total=counts.safe+counts.suspicious+counts.malicious;
  const ph=hint(apiKey);const pc=PC[ph]||"var(--accent)";

  return (
    <>
      <LoadingScreen onComplete={handleLoaded}/>
      <AnimatePresence>
        {loaded&&(
          <motion.div key="app" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.3}}
            className="flex flex-col" style={{height:"100dvh",overflow:"hidden"}}>

            {/* Header */}
            <header className="shrink-0 flex items-center gap-3 px-4 h-14 z-40 relative"
              style={{background:"var(--bg2)",borderBottom:"1px solid var(--border)",boxShadow:"0 1px 0 var(--border)"}}>
              <button className="md:hidden p-1.5 rounded-lg" style={{color:"var(--text2)"}} onClick={()=>setMobileSidebar(!mobileSidebar)}>
                {mobileSidebar?<X size={16}/>:<Menu size={16}/>}
              </button>

              {/* Logo */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:"linear-gradient(135deg,#0ea5e9,#6366f1)",boxShadow:"0 2px 10px rgba(14,165,233,0.25)"}}>
                  <ShieldCheck size={15} className="text-white"/>
                </div>
                <div>
                  <span className="font-display text-base" style={{color:"var(--text)"}}>PromptShield</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot"/>
                    <span className="text-xs font-mono" style={{color:"var(--text3)",fontSize:"9px"}}>99.88% acc</span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <nav className="flex gap-0.5 p-1 rounded-xl ml-1 shrink-0" style={{background:"var(--bg3)"}}>
                {TABS.map(t=>(
                  <button key={t.id} onClick={()=>setTab(t.id)}
                    className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{color:tab===t.id?"var(--text)":"var(--text3)"}}>
                    {tab===t.id&&<motion.div layoutId="tab-pill" className="absolute inset-0 rounded-lg"
                      style={{background:"var(--card)",boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}
                      transition={{type:"spring",stiffness:400,damping:30}}/>}
                    <span className="relative"><t.Icon size={12}/></span>
                    <span className="relative hidden sm:block">{t.label}</span>
                  </button>
                ))}
              </nav>

              {/* API Key bar */}
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl mx-1 min-w-0"
                style={{background:"var(--bg3)",border:"1px solid var(--border2)"}}>
                <Key size={12} style={{color:"var(--text3)",flexShrink:0}}/>
                <input type={showKey?"text":"password"} value={apiKey} onChange={e=>updateKey(e.target.value)}
                  placeholder="Paste any API key — Gemini · OpenAI · Claude · Groq · Mistral · Cohere"
                  className="flex-1 bg-transparent text-xs outline-none font-mono min-w-0"
                  style={{color:"var(--text)",fontFamily:"var(--font-mono)"}}/>
                {apiKey&&(
                  <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono"
                    style={{color:pc,background:pc+"18",border:`1px solid ${pc}28`,fontSize:"10px",whiteSpace:"nowrap"}}>
                    <Zap size={8}/>{ph}
                  </span>
                )}
                <button onClick={()=>setShowKey(!showKey)} style={{color:"var(--text3)",flexShrink:0}}>
                  {showKey?<EyeOff size={12}/>:<Eye size={12}/>}
                </button>
              </div>

              {/* Stats */}
              {total>0&&(
                <div className="hidden sm:flex items-center gap-2 shrink-0 font-mono text-xs">
                  <span style={{color:"#10b981"}}>{counts.safe}✓</span>
                  <span style={{color:"#f59e0b"}}>{counts.suspicious}~</span>
                  <span style={{color:"#ef4444"}}>{counts.malicious}✗</span>
                </div>
              )}

              <button onClick={newChat} title="New Chat"
                className="shrink-0 p-2 rounded-xl transition-colors hidden sm:flex items-center"
                style={{background:"var(--bg3)",border:"1px solid var(--border)",color:"var(--text2)"}}
                onMouseEnter={e=>(e.currentTarget.style.color="var(--accent)")}
                onMouseLeave={e=>(e.currentTarget.style.color="var(--text2)")}>
                <Plus size={14}/>
              </button>

              <button onClick={()=>setDark(!dark)}
                className="shrink-0 p-2 rounded-xl transition-all"
                style={{background:"var(--bg3)",border:"1px solid var(--border)",color:"var(--text2)"}}>
                {dark?<Sun size={14}/>:<Moon size={14}/>}
              </button>
            </header>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Mobile overlay */}
              <AnimatePresence>
                {mobileSidebar&&(
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                    onClick={()=>setMobileSidebar(false)}
                    className="fixed inset-0 z-30 md:hidden" style={{background:"rgba(0,0,0,0.5)"}}/>
                )}
              </AnimatePresence>

              {/* Sidebar — only show in chat tab */}
              {tab==="chat"&&(
                <div className={`md:relative fixed left-0 top-14 bottom-0 z-40 transition-transform duration-200 ${mobileSidebar?"translate-x-0":"-translate-x-full md:translate-x-0"}`}>
                  <Sidebar currentSessionId={session?.id||null} onSelectSession={selectSession}
                    onNewChat={newChat} refreshTrigger={refresh}
                    collapsed={sidebarCollapsed} onToggleCollapse={()=>setSidebarCollapsed(!sidebarCollapsed)}/>
                </div>
              )}

              {/* Main content */}
              <main className="flex-1 overflow-hidden min-w-0 flex flex-col">
                <AnimatePresence mode="wait">
                  {tab==="chat"?(
                    <motion.div key="chat" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} transition={{duration:0.15}}
                      className="flex-1 min-h-0 overflow-hidden flex flex-col">
                      {session&&<ChatPanel session={session} onSessionUpdate={onSessionUpdate} apiKey={apiKey} onScan={onScan}/>}
                    </motion.div>
                  ):tab==="scan"?(
                    <motion.div key="scan" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} transition={{duration:0.15}}
                      className="flex-1 overflow-y-auto p-6">
                      <ScanPanel onScan={onScan} apiKey={apiKey}/>
                    </motion.div>
                  ):(
                    <motion.div key="analytics" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} transition={{duration:0.15}}
                      className="flex-1 overflow-y-auto p-6">
                      <AnalyticsPanel/>
                    </motion.div>
                  )}
                </AnimatePresence>
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
