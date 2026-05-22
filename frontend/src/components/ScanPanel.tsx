"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Image, Scan, X, Loader2, Bot, Zap } from "lucide-react";
import RiskScore from "./RiskScore";
import { scanFile, scanImage } from "@/lib/api";

function hint(k: string): string {
  if (!k) return "";
  if (k.startsWith("sk-ant-")) return "Anthropic";
  if (k.startsWith("sk-or-"))  return "OpenRouter";
  if (k.startsWith("sk-"))     return "OpenAI";
  if (k.startsWith("AIza"))    return "Gemini";
  if (k.startsWith("gsk_"))    return "Groq";
  if (k.length===32&&/^[0-9a-fA-F]+$/.test(k)) return "Mistral";
  if (k.length>=36) return "Cohere";
  return "Unknown";
}

const PROVIDER_COLORS: Record<string,string> = {
  Gemini:"#3b82f6", OpenAI:"#10b981", Anthropic:"#f97316",
  Groq:"#a855f7", Mistral:"#ec4899", Cohere:"#06b6d4", OpenRouter:"#eab308",
};

interface Props { onScan:(level:string)=>void; apiKey:string; }

export default function ScanPanel({ onScan, apiKey }: Props) {
  const [mode, setMode] = useState<"file"|"image">("file");
  const [file, setFile] = useState<File|null>(null);
  const [result, setResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [prompt, setPrompt] = useState("Summarise this document.");
  const inputRef = useRef<HTMLInputElement>(null);
  const ph = hint(apiKey);
  const pc = PROVIDER_COLORS[ph]||"var(--accent)";

  const handleFile = (f: File) => { setFile(f); setResult(null); setError(null); };
  const reset = () => { setFile(null); setResult(null); setError(null); };

  const runScan = async () => {
    if (!file) return;
    setScanning(true); setError(null); setResult(null);
    try {
      const res = mode==="file" ? await scanFile(file, prompt, apiKey) : await scanImage(file);
      setResult(res); onScan(res.risk_level);
    } catch (e:any) { setError(e.message||"Scan failed"); }
    finally { setScanning(false); }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="font-display text-xl font-normal mb-1" style={{ color:"var(--text)" }}>File & Image Scanner</h2>
        <p className="text-sm" style={{ color:"var(--text2)" }}>Upload a document or image to detect embedded prompt injection attacks.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left */}
        <div className="space-y-4">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background:"var(--bg3)" }}>
            {(["file","image"] as const).map(m=>(
              <button key={m} onClick={()=>{setMode(m);reset();}}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex-1 justify-center"
                style={{ background:mode===m?"var(--card)":"transparent", color:mode===m?"var(--text)":"var(--text3)", boxShadow:mode===m?"0 1px 3px rgba(0,0,0,0.1)":"none" }}>
                {m==="file"?<FileText size={13}/>:<Image size={13}/>}
                <span className="capitalize">{m}</span>
              </button>
            ))}
          </div>

          <div onClick={()=>inputRef.current?.click()}
            onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
            onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
            className="relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all"
            style={{ borderColor:dragOver?"var(--accent)":file?"#10b981":"var(--border2)", background:dragOver?"var(--accent-dim)":file?"rgba(16,185,129,0.04)":"transparent" }}>
            <input ref={inputRef} type="file"
              accept={mode==="file"?".pdf,.docx,.txt":"image/png,image/jpeg,image/webp"}
              className="hidden" onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0])}/>
            {file ? (
              <div className="space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center" style={{ background:"rgba(16,185,129,0.12)" }}>
                  {mode==="file"?<FileText size={22} className="text-emerald-500"/>:<Image size={22} className="text-emerald-500"/>}
                </div>
                <p className="font-medium truncate max-w-xs mx-auto" style={{ color:"var(--text)" }}>{file.name}</p>
                <p className="text-xs font-mono" style={{ color:"var(--text3)" }}>{(file.size/1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center" style={{ background:"var(--bg3)" }}>
                  <Upload size={24} style={{ color:"var(--text3)" }}/>
                </div>
                <div>
                  <p className="font-medium" style={{ color:"var(--text2)" }}>Drop {mode==="file"?"a file":"an image"} here</p>
                  <p className="text-xs mt-1 font-mono" style={{ color:"var(--text3)" }}>
                    {mode==="file"?"PDF, DOCX, or TXT · max 10 MB":"PNG, JPEG, WebP · max 20 MB"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {mode==="file" && (
            <div className="rounded-xl px-3 py-2.5" style={{ background:"var(--card)", border:"1px solid var(--border)" }}>
              <p className="text-xs font-mono mb-1.5" style={{ color:"var(--text3)" }}>Question for the AI</p>
              <input type="text" value={prompt} onChange={e=>setPrompt(e.target.value)}
                className="w-full bg-transparent text-sm outline-none" style={{ color:"var(--text)" }}
                placeholder="e.g. Summarise this document."/>
            </div>
          )}

          {mode==="file" && (
            <div className="flex items-center gap-2 text-xs font-mono" style={{ color:"var(--text3)", fontSize:"11px" }}>
              {apiKey ? (
                <span className="flex items-center gap-1" style={{ color:pc }}>
                  <Zap size={10}/> Using {ph} (key set in header)
                </span>
              ) : (
                <span>⚠ No API key — paste one in the header bar for AI answers</span>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={runScan} disabled={!file||scanning}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background:"linear-gradient(135deg,#0ea5e9,#6366f1)", boxShadow:"0 2px 12px rgba(14,165,233,0.25)" }}>
              {scanning?<><Loader2 size={14} className="animate-spin"/>Scanning…</>:<><Scan size={14}/>Scan {mode==="file"?"File":"Image"}</>}
            </button>
            {file && (
              <button onClick={reset} className="px-4 py-3 rounded-xl transition-colors"
                style={{ border:"1px solid var(--border2)", color:"var(--text3)" }}>
                <X size={15}/>
              </button>
            )}
          </div>

          {error && <div className="p-3 rounded-xl text-sm" style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", color:"#f87171" }}>{error}</div>}

          {scanning && (
            <div className="relative overflow-hidden rounded-xl h-14 flex items-center justify-center"
              style={{ background:"var(--bg3)", border:"1px solid var(--border)" }}>
              <div className="scan-beam"/>
              <span className="text-xs font-mono z-10 relative" style={{ color:"var(--accent)" }}>
                Scanning{apiKey?` + calling ${ph}…`:"…"}
              </span>
            </div>
          )}
        </div>

        {/* Right */}
        <div>
          <AnimatePresence>
            {result ? (
              <motion.div key="r" initial={{opacity:0,x:8}} animate={{opacity:1,x:0}} className="space-y-4">
                <RiskScore result={result}/>
                {result.llm_response && (
                  <div className="rounded-xl p-4" style={{ background:"var(--card)", border:`1px solid ${pc}28` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Bot size={13} style={{ color:pc }}/>
                      <p className="text-xs font-mono uppercase tracking-widest" style={{ color:pc }}>{result.provider_name||"AI"} Response</p>
                      <span className="ml-auto flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-md"
                        style={{ color:pc, background:pc+"18", border:`1px solid ${pc}28`, fontSize:"10px" }}>
                        <Zap size={8}/>{result.provider_name}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color:"var(--text2)" }}>{result.llm_response}</p>
                  </div>
                )}
                {result.extracted_text_preview && (
                  <div className="rounded-xl p-4" style={{ background:"var(--card)", border:"1px solid var(--border)" }}>
                    <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color:"var(--text3)" }}>Extracted Content</p>
                    <p className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all" style={{ color:"var(--text3)" }}>
                      {result.extracted_text_preview}{result.extracted_text_preview.length>=500&&<span style={{ color:"var(--text3)", opacity:0.4 }}> …[truncated]</span>}
                    </p>
                  </div>
                )}
                {result.heuristics && (
                  <div className="rounded-xl p-4 space-y-2" style={{ background:"var(--card)", border:"1px solid var(--border)" }}>
                    <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color:"var(--text3)" }}>Visual Heuristics</p>
                    {Object.entries(result.heuristics).map(([k,v])=>(
                      <div key={k} className="flex items-center justify-between text-xs">
                        <span style={{ color:"var(--text2)" }}>{k.replace(/_/g," ")}</span>
                        <span className="font-mono font-semibold" style={{ color:v?"#ef4444":"#10b981", fontSize:"10px" }}>{v?"DETECTED":"CLEAR"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="e" initial={{opacity:0}} animate={{opacity:1}}
                className="flex flex-col items-center justify-center h-64 text-center rounded-2xl"
                style={{ background:"var(--bg3)", border:"2px dashed var(--border)" }}>
                <Scan size={28} className="mb-3" style={{ color:"var(--text3)", opacity:0.4 }}/>
                <p className="text-sm" style={{ color:"var(--text3)" }}>Scan results appear here</p>
                <p className="text-xs mt-1 font-mono" style={{ color:"var(--text3)", opacity:0.6 }}>
                  {mode==="file"?"Upload a file to detect hidden injections":"Upload an image for OCR scan"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
