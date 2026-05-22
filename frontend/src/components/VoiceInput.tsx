"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, VolumeX, Square } from "lucide-react";

interface Props {
  onTranscript: (text: string) => void;
  ttsText?: string;
  disabled?: boolean;
}

export default function VoiceInput({ onTranscript, ttsText, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    const hasSpeech = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    const hasTts = "speechSynthesis" in window;
    setSupported(hasSpeech);
    setTtsSupported(hasTts);
    if (hasTts) synthRef.current = window.speechSynthesis;
  }, []);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => setListening(true);
    rec.onend = () => { setListening(false); setInterim(""); };
    rec.onerror = () => { setListening(false); setInterim(""); };

    rec.onresult = (e: any) => {
      let interimTranscript = "";
      let finalTranscript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += t;
        else interimTranscript += t;
      }
      setInterim(interimTranscript);
      if (finalTranscript) {
        onTranscript(finalTranscript.trim());
        setInterim("");
      }
    };

    recognitionRef.current = rec;
    rec.start();
  }, [onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  const speak = useCallback((text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.pitch = 1.0;
    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    synthRef.current.speak(utt);
  }, []);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setSpeaking(false);
  }, []);

  // Auto-speak when ttsText changes
  useEffect(() => {
    if (ttsText && ttsSupported) speak(ttsText);
  }, [ttsText]);

  if (!supported && !ttsSupported) return null;

  return (
    <div className="flex items-center gap-1">
      {/* Interim transcript bubble */}
      <AnimatePresence>
        {interim && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 8 }}
            className="absolute bottom-full right-0 mb-2 px-3 py-2 rounded-xl text-xs font-mono max-w-xs truncate z-10"
            style={{ background: "var(--card)", border: "1px solid var(--accent)", color: "var(--text2)",
              boxShadow: "0 4px 20px rgba(14,165,233,0.15)" }}
          >
            <span className="text-sky-400 mr-1.5">●</span>{interim}
          </motion.div>
        )}
      </AnimatePresence>

      {/* STT button */}
      {supported && (
        <button
          onClick={listening ? stopListening : startListening}
          disabled={disabled}
          title={listening ? "Stop recording" : "Voice input"}
          className="p-1.5 rounded-lg transition-all relative"
          style={{
            color: listening ? "#0ea5e9" : "var(--text3)",
            background: listening ? "var(--accent-dim)" : "transparent",
          }}
        >
          {listening ? (
            <>
              <Mic size={14} />
              {/* Pulse ring */}
              <motion.span
                animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="absolute inset-0 rounded-lg"
                style={{ background: "rgba(14,165,233,0.2)" }}
              />
            </>
          ) : (
            <MicOff size={14} />
          )}
        </button>
      )}

      {/* TTS button */}
      {ttsSupported && (
        <button
          onClick={speaking ? stopSpeaking : () => ttsText && speak(ttsText)}
          disabled={!ttsText && !speaking}
          title={speaking ? "Stop speaking" : "Read aloud"}
          className="p-1.5 rounded-lg transition-all"
          style={{
            color: speaking ? "#10b981" : "var(--text3)",
            background: speaking ? "rgba(16,185,129,0.1)" : "transparent",
            opacity: (!ttsText && !speaking) ? 0.35 : 1,
          }}
        >
          {speaking ? (
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
              <Square size={14} className="text-emerald-500" />
            </motion.div>
          ) : (
            <Volume2 size={14} />
          )}
        </button>
      )}
    </div>
  );
}
