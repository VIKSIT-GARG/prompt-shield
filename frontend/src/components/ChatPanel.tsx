"use client";
import { useState, useRef, useEffect, KeyboardEvent, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ShieldCheck, ShieldX, ShieldAlert, Bot, User, Zap, Paperclip, X, FileText, Copy, Check } from "lucide-react";
import RiskScore from "./RiskScore";
import HighlightedText from "./HighlightedText";
import VoiceInput from "./VoiceInput";
import { scanText, scanFile } from "@/lib/api";
import { ChatSession, ChatMessage, saveSession, generateTitle } from "@/lib/history";

const SHIELD_ICONS: Record<string, JSX.Element> = {
  safe:       <ShieldCheck size={11} className="text-emerald-500"/>,
  suspicious: <ShieldAlert size={11} className="text-amber-500"/>,
  malicious:  <ShieldX size={11} className="text-red-500"/>,
};
const PROVIDER_COLORS: Record<string,string> = {
  gemini:"#3b82f6",openai:"#10b981",anthropic:"#f97316",
  groq:"#a855f7",mistral:"#ec4899",cohere:"#06b6d4",openrouter:"#eab308",
};
function hint(k:string):string {
  if(!k)return"";
  if(k.startsWith("sk-ant-"))return"Anthropic";
  if(k.startsWith("sk-or-"))return"OpenRouter";
  if(k.startsWith("sk-"))return"OpenAI";
  if(k.startsWith("AIza"))return"Gemini";
  if(k.startsWith("gsk_"))return"Groq";
  if(k.length===32&&/^[0-9a-fA-F]+$/.test(k))return"Mistral";
  if(k.length>=36)return"Cohere";
  return"Unknown";
}
const WELCOME:ChatMessage={id:"welcome",role:"assistant",
  text:"Hello! I'm protected by PromptShield.\n\nAll messages are scanned for prompt injection before reaching the AI. Paste any API key in the header — Gemini, OpenAI, Claude, Groq, Mistral, or Cohere.\n\n🎤 Use the mic button to speak your message. 🔊 AI responses can be read aloud.",
  timestamp:new Date().toISOString()};

interface Props {
  session:ChatSession; onSessionUpdate:(s:ChatSession)=>void;
  apiKey:string; onScan:(level:string)=>void;
}

export default function ChatPanel({session,onSessionUpdate,apiKey,onScan}:Props) {
  const [messages,setMessages]=useState<ChatMessage[]>(session.messages.length>0?session.messages:[WELCOME]);
  const [input,setInput]=useState("");
  const [scanning,setScanning]=useState(false);
  const [expandedId,setExpandedId]=useState<string|null>(null);
  const [showHighlight,setShowHighlight]=useState<string|null>(null);
  const [attachedFile,setAttachedFile]=useState<File|null>(null);
  const [copiedId,setCopiedId]=useState<string|null>(null);
  const [lastAiText,setLastAiText]=useState<string|undefined>();
  const bottomRef=useRef<HTMLDivElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const textareaRef=useRef<HTMLTextAreaElement>(null);
  const ph=hint(apiKey);
  const pc=PROVIDER_COLORS[ph.toLowerCase()]||"var(--accent)";

  useEffect(()=>{setMessages(session.messages.length>0?session.messages:[WELCOME]);setInput("");setAttachedFile(null);},[session.id]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  useEffect(()=>{
    if(textareaRef.current){textareaRef.current.style.height="auto";textareaRef.current.style.height=Math.min(textareaRef.current.scrollHeight,160)+"px";}
  },[input]);

  const persist=(msgs:ChatMessage[],stats:typeof session.stats)=>{
    const updated:ChatSession={...session,messages:msgs.filter(m=>m.id!=="welcome"),title:generateTitle(msgs),updatedAt:new Date().toISOString(),stats};
    saveSession(updated);onSessionUpdate(updated);
  };
  const copy=(id:string,text:string)=>{navigator.clipboard.writeText(text);setCopiedId(id);setTimeout(()=>setCopiedId(null),1500);};

  const handleSend=async()=>{
    const text=input.trim();
    if((!text&&!attachedFile)||scanning)return;
    setInput("");const file=attachedFile;setAttachedFile(null);setScanning(true);
    const displayText=file?`📎 ${file.name}${text?"\n"+text:""}`:text;
    const userMsgId=crypto.randomUUID();
    const userMsg:ChatMessage={id:userMsgId,role:"user",text:displayText,timestamp:new Date().toISOString()};
    const scanMsg:ChatMessage={id:"__scan__",role:"system",text:"scanning…",timestamp:new Date().toISOString()};
    setMessages(prev=>[...prev,userMsg,scanMsg]);
    try {
      const result=file?await scanFile(file,text||"Summarise this document.",apiKey):await scanText(text,apiKey);
      onScan(result.risk_level);
      const newStats={
        safe:      session.stats.safe      +(result.risk_level==="safe"?1:0),
        suspicious:session.stats.suspicious+(result.risk_level==="suspicious"?1:0),
        malicious: session.stats.malicious +(result.risk_level==="malicious"?1:0),
      };
      const userWithScan:ChatMessage={...userMsg,scanResult:result};
      let replyMsg:ChatMessage;
      if(result.is_injection){
        replyMsg={id:crypto.randomUUID(),role:"assistant",blocked:true,timestamp:new Date().toISOString(),
          text:"🛡️ Blocked by PromptShield — prompt injection detected. Not forwarded to the AI."};
      } else if(result.llm_response){
        replyMsg={id:crypto.randomUUID(),role:"assistant",timestamp:new Date().toISOString(),
          text:result.llm_response,scanResult:{_provider:result.provider_name}};
        setLastAiText(result.llm_response);
      } else {
        replyMsg={id:crypto.randomUUID(),role:"assistant",timestamp:new Date().toISOString(),
          text:`✅ Cleared (${result.risk_level}). Add an API key in the header for real AI responses.`};
      }
      const nonWelcome=messages.filter(m=>m.id!=="welcome"&&m.id!=="__scan__");
      persist([...nonWelcome,userWithScan,replyMsg],newStats);
      setMessages(prev=>prev.filter(m=>m.id!=="__scan__").map(m=>m.id===userMsgId?userWithScan:m).concat(replyMsg));
    } catch(err:any){
      setMessages(prev=>prev.filter(m=>m.id!=="__scan__").concat({id:crypto.randomUUID(),role:"system",text:`⚠️ ${err.message}`,timestamp:new Date().toISOString()}));
    } finally{setScanning(false);}
  };

  const onKeyDown=(e:KeyboardEvent<HTMLTextAreaElement>)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();}};

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map(msg=>(
            <motion.div key={msg.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.2}}
              className={`group flex gap-3 ${msg.role==="user"?"flex-row-reverse":""}`}>
              {msg.role!=="system"&&(
                <div className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center mt-0.5" style={{
                  background:msg.role==="user"?"linear-gradient(135deg,#6d28d9,#4f46e5)":msg.blocked?"rgba(239,68,68,0.1)":"linear-gradient(135deg,#0284c7,#0891b2)",
                  border:msg.blocked?"1px solid rgba(239,68,68,0.25)":"none",
                }}>
                  {msg.role==="user"?<User size={12} className="text-white"/>:<Bot size={12} style={{color:msg.blocked?"#f87171":"white"}}/>}
                </div>
              )}
              <div className={`flex flex-col gap-1.5 max-w-[76%] min-w-0 ${msg.role==="user"?"items-end":"items-start"}`}>
                {/* Provider badge */}
                {msg.role==="assistant"&&!msg.blocked&&msg.scanResult?._provider&&(
                  <span className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-md w-fit"
                    style={{color:pc,background:pc+"18",border:`1px solid ${pc}28`,fontSize:"10px"}}>
                    <Zap size={8}/>{msg.scanResult._provider}
                  </span>
                )}

                {msg.role==="system"?(
                  <div className="flex items-center gap-2 text-xs font-mono" style={{color:"var(--text3)"}}>
                    <div className="typing"><span/><span/><span/></div>
                    {apiKey?"Scanning + calling AI…":"Scanning…"}
                  </div>
                ):(
                  <div className="relative group/bubble w-full">
                    <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words" style={{
                      background:msg.role==="user"?"linear-gradient(135deg,rgba(79,70,229,0.25),rgba(109,40,217,0.20))":msg.blocked?"rgba(239,68,68,0.06)":"var(--card)",
                      border:msg.role==="user"?"1px solid rgba(99,102,241,0.25)":msg.blocked?"1px solid rgba(239,68,68,0.2)":"1px solid var(--border)",
                      color:msg.blocked?"#f87171":"var(--text)",
                      borderRadius:msg.role==="user"?"18px 4px 18px 18px":"4px 18px 18px 18px",
                    }}>{msg.text}</div>
                    {msg.role==="assistant"&&!msg.blocked&&(
                      <div className="absolute -bottom-1 -right-1 opacity-0 group-hover/bubble:opacity-100 flex gap-1 transition-all">
                        <button onClick={()=>copy(msg.id,msg.text)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                          style={{background:"var(--bg3)",border:"1px solid var(--border)",color:"var(--text3)"}}>
                          {copiedId===msg.id?<Check size={10} className="text-emerald-500"/>:<Copy size={10}/>}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Scan badge + highlight toggle */}
                {msg.scanResult&&!msg.scanResult._provider&&(
                  <div className="w-full space-y-2">
                    <div className="flex items-center gap-2">
                      <button onClick={()=>setExpandedId(expandedId===msg.id?null:msg.id)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono transition-colors"
                        style={{
                          color:msg.scanResult.risk_level==="safe"?"#10b981":msg.scanResult.risk_level==="suspicious"?"#f59e0b":"#ef4444",
                          background:msg.scanResult.risk_level==="safe"?"rgba(16,185,129,0.06)":msg.scanResult.risk_level==="suspicious"?"rgba(245,158,11,0.06)":"rgba(239,68,68,0.06)",
                          border:`1px solid ${msg.scanResult.risk_level==="safe"?"rgba(16,185,129,0.15)":msg.scanResult.risk_level==="suspicious"?"rgba(245,158,11,0.15)":"rgba(239,68,68,0.15)"}`,
                          fontSize:"10px",
                        }}>
                        {SHIELD_ICONS[msg.scanResult.risk_level]}
                        {(msg.scanResult.risk_score*100).toFixed(0)} · {msg.scanResult.risk_level.toUpperCase()} · {msg.scanResult.processing_time_ms}ms
                        <span className="ml-1 opacity-50">{expandedId===msg.id?"▲":"▼"}</span>
                      </button>
                      {/* Highlight toggle */}
                      {msg.scanResult.flagged_count > 0 && (
                        <button onClick={()=>setShowHighlight(showHighlight===msg.id?null:msg.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono transition-colors"
                          style={{
                            color:"#ef4444",background:"rgba(239,68,68,0.06)",
                            border:"1px solid rgba(239,68,68,0.2)",fontSize:"10px",
                          }}>
                          ⚠ {msg.scanResult.flagged_count} flag{msg.scanResult.flagged_count!==1?"s":""} — show
                        </button>
                      )}
                    </div>

                    {/* Highlight view */}
                    <AnimatePresence>
                      {showHighlight===msg.id&&msg.scanResult.segments&&(
                        <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                          <HighlightedText segments={msg.scanResult.segments} flaggedCount={msg.scanResult.flagged_count}/>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Score breakdown */}
                    <AnimatePresence>
                      {expandedId===msg.id&&(
                        <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                          <RiskScore result={msg.scanResult} compact/>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <span style={{color:"var(--text3)",fontFamily:"var(--font-mono)",fontSize:"10px"}}>
                  {new Date(msg.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef}/>
      </div>

      {/* File preview */}
      <AnimatePresence>
        {attachedFile&&(
          <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}
            className="shrink-0 mx-4 mb-2 px-3 py-2 rounded-xl flex items-center gap-2"
            style={{background:"var(--bg3)",border:"1px solid var(--border)"}}>
            <FileText size={12} style={{color:"var(--accent)"}}/>
            <span className="text-xs truncate flex-1 font-mono" style={{color:"var(--text2)"}}>{attachedFile.name}</span>
            <span className="text-xs font-mono shrink-0" style={{color:"var(--text3)"}}>{(attachedFile.size/1024).toFixed(0)}KB</span>
            <button onClick={()=>setAttachedFile(null)} style={{color:"var(--text3)"}}><X size={11}/></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="shrink-0 px-4 pb-4">
        <div className="rounded-2xl overflow-hidden transition-all" style={{
          background:"var(--card)",border:"1px solid var(--border2)",boxShadow:"0 4px 20px rgba(0,0,0,0.06)",
        }}>
          <textarea ref={textareaRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKeyDown}
            placeholder={attachedFile?"Ask something about the file…":"Type a message… (Enter to send, Shift+Enter for new line)"}
            style={{minHeight:"52px",maxHeight:"160px",color:"var(--text)",background:"transparent",fontFamily:"var(--font-sans)"}}
            className="w-full text-sm placeholder-[color:var(--text3)] resize-none outline-none px-4 pt-3.5 pb-2"/>
          <div className="flex items-center gap-2 px-3 pb-3 pt-1" style={{borderTop:"1px solid var(--border)"}}>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
              onChange={e=>e.target.files?.[0]&&setAttachedFile(e.target.files[0])}/>
            <button onClick={()=>fileRef.current?.click()} title="Attach file"
              className="p-1.5 rounded-lg transition-colors"
              style={{color:"var(--text3)"}}
              onMouseEnter={e=>(e.currentTarget.style.color="var(--accent)")}
              onMouseLeave={e=>(e.currentTarget.style.color="var(--text3)")}>
              <Paperclip size={14}/>
            </button>

            {/* Voice controls */}
            <div className="relative">
              <VoiceInput
                onTranscript={text=>setInput(prev=>prev?prev+" "+text:text)}
                ttsText={lastAiText}
                disabled={scanning}
              />
            </div>

            <div className="flex-1 flex items-center gap-2 min-w-0">
              {apiKey?(
                <span className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-md"
                  style={{color:pc,background:pc+"18",border:`1px solid ${pc}25`,fontSize:"10px"}}>
                  <Zap size={8}/>{ph}
                </span>
              ):(
                <span className="text-xs font-mono" style={{color:"var(--text3)",fontSize:"10px"}}>
                  🔑 Add API key in header
                </span>
              )}
            </div>
            {input.length>0&&<span className="text-xs font-mono shrink-0" style={{color:"var(--text3)",fontSize:"10px"}}>{input.length}</span>}
            <button onClick={handleSend} disabled={(!input.trim()&&!attachedFile)||scanning}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{background:"linear-gradient(135deg,#0ea5e9,#6366f1)",boxShadow:"0 2px 10px rgba(14,165,233,0.3)"}}>
              {scanning?<div className="typing text-white scale-75"><span/><span/><span/></div>:<><Send size={12}/>Send</>}
            </button>
          </div>
        </div>
        <p className="text-center text-xs mt-1.5" style={{color:"var(--text3)",fontSize:"10px",fontFamily:"var(--font-mono)"}}>
          All messages scanned · 🎤 mic for voice · 🔊 TTS for AI responses
        </p>
      </div>
    </div>
  );
}
