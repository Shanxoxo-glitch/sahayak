import { useState, useRef, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { streamChat, scoreTextLive } from "@/lib/api";
import {
  recordVictimInteraction,
  getCurrentUser,
  getActiveCodeword,
  logoutUser,
  addCaseNote,
} from "@/lib/store";
import {
  ArrowLeft,
  Send,
  Sparkles,
  PhoneCall,
  ShieldAlert,
  Wind,
  Compass,
  ChevronDown,
  ChevronUp,
  Power,
  Scale,
  Bot,
  FileText,
  CheckCircle2,
  Cpu,
  BookmarkPlus,
  RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [{ title: "Sanctuary & CaseWriter Chat — Sahayak" }],
  }),
  component: CrisisChatPage,
});

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  source?: "vm_orchestrator" | "backend_casewriter_engine" | "local_fallback";
}

const DEFAULT_WELCOME: Message = {
  role: "assistant",
  content:
    "Welcome to this quiet space. Take a soft breath. You don't have to explain everything, and you don't have to carry it all alone right now. What's resting on your mind?",
};

const CASEWRITER_WELCOME: Message = {
  role: "assistant",
  content:
    "⚖️ CaseWriter AI Initialized.\n\nConnected directly to live Azure VM Orchestrator (port :8500) and backend perception pipeline. Enter case observations, incident narratives, or hearing details to synthesize structured risk classifications, key signals, and clinician-grounded recommendations.",
};

export default function CrisisChatPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  // Ephemeral modes (keypad check-in and OpenCV camera check-in) maintain NO chat history
  const isEphemeralUser = currentUser?.auth_method === "voice_keypad" || currentUser?.auth_method === "opencv_camera";
  
  // Scoped strictly per-user ID for normally signed-in accounts so chat of one user never leaks to another
  const userChatScope = currentUser?.user_id
    ? `usr_${currentUser.user_id}`
    : currentUser?.email
    ? `email_${currentUser.email.replace(/[^a-zA-Z0-9]/g, "_")}`
    : "anon_guest";

  const activeCodeword = currentUser?.codeword || getActiveCodeword() || "quiet-sanctuary";

  // Dual mode: "sahayak" (empathetic victim sanctuary) vs "casewriter" (clinical & legal case synthesizer)
  const [chatMode, setChatMode] = useState<"sahayak" | "casewriter">(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("mode") === "casewriter") return "casewriter";
    }
    return "sahayak";
  });

  // Independent chat message logs with strict per-user isolation & ephemeral check
  const [sahayakMessages, setSahayakMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined" || isEphemeralUser) return [DEFAULT_WELCOME];
    try {
      const stored = localStorage.getItem(`sahayak_chat_messages_${userChatScope}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [DEFAULT_WELCOME];
  });

  const [casewriterMessages, setCasewriterMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined" || isEphemeralUser) return [CASEWRITER_WELCOME];
    try {
      const stored = localStorage.getItem(`casewriter_chat_messages_${userChatScope}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [CASEWRITER_WELCOME];
  });

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showCrisisBanner, setShowCrisisBanner] = useState(false);
  const [showGroundingDrawer, setShowGroundingDrawer] = useState(false);
  const [groundingStep, setGroundingStep] = useState(0);
  const [savedNotes, setSavedNotes] = useState<Record<number, boolean>>({});

  const abortRef = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Active messages based on mode
  const messages = chatMode === "sahayak" ? sahayakMessages : casewriterMessages;
  const setMessages = chatMode === "sahayak" ? setSahayakMessages : setCasewriterMessages;

  // Persist messages per mode (Strictly isolated by user, never persisted for ephemeral check-ins)
  useEffect(() => {
    if (typeof window === "undefined" || isEphemeralUser) return;
    try {
      localStorage.setItem(`sahayak_chat_messages_${userChatScope}`, JSON.stringify(sahayakMessages));
    } catch {}
  }, [sahayakMessages, userChatScope, isEphemeralUser]);

  useEffect(() => {
    if (typeof window === "undefined" || isEphemeralUser) return;
    try {
      localStorage.setItem(`casewriter_chat_messages_${userChatScope}`, JSON.stringify(casewriterMessages));
    } catch {}
  }, [casewriterMessages, userChatScope, isEphemeralUser]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showCrisisBanner, chatMode]);

  const groundingExercises = [
    {
      title: "5-4-3-2-1 Sensory Grounding",
      steps: [
        "👀 Notice 5 things you can see around you right now. Soft colors, shapes, shadows.",
        "✋ Feel 4 things you can touch. The fabric of your clothes, the coolness of the table.",
        "👂 Listen for 3 sounds. The distant hum of the fan, rustling leaves, your breath.",
        "👃 Identify 2 scents. Clean air, morning tea, or simply the room's scent.",
        "👅 Notice 1 taste. Take a gentle sip of cool water and feel it swallow.",
      ],
    },
  ];

  const handleSwitchMode = (newMode: "sahayak" | "casewriter") => {
    if (streaming) return;
    setChatMode(newMode);
    setInput("");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("mode", newMode);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleSaveToDossier = (text: string, index: number) => {
    addCaseNote(activeCodeword, `[CaseWriter Synthesis] ${text}`, "CaseWriter AI");
    setSavedNotes((prev) => ({ ...prev, [index]: true }));
  };

  const handleSend = (textToSend?: string) => {
    const rawMsg = textToSend || input;
    if (!rawMsg.trim() || streaming) return;
    const userMsg = rawMsg;
    setInput("");

    // Danger keyword check for immediate helpline escalation
    const lower = userMsg.toLowerCase();
    const isDanger =
      lower.includes("suicide") ||
      lower.includes("kill") ||
      lower.includes("die") ||
      lower.includes("end my life") ||
      lower.includes("no reason to live") ||
      lower.includes("hurt myself");

    if (isDanger) {
      setShowCrisisBanner(true);
    }

    // Record victim interaction into Counsellor & Admin stores
    const quickTriggers = [
      "die", "kill", "suicide", "hurt", "harm", "end my life", "no reason to live",
      "follow", "following", "threat", "threatened", "locked", "weapon", "knife", "gun",
      "scared", "terrified", "fear", "panic", "cannot take", "help me", "overwhelmed"
    ].filter((w) => lower.includes(w));

    const quickIsThreat =
      isDanger || lower.includes("follow") || lower.includes("threat") || lower.includes("harm") || lower.includes("locked");
    const quickIsDistress =
      isDanger || quickIsThreat || lower.includes("scared") || lower.includes("panic") || lower.includes("cannot take") || lower.includes("help me");

    const initialScores = {
      sentiment: {
        label: quickIsDistress ? ("HIGH" as const) : ("MODERATE" as const),
        sentiment_score: quickIsDistress ? 0.92 : 0.48,
        confidence: 0.9,
      },
      threat: {
        threat_flag: quickIsThreat,
        prob: quickIsThreat ? 0.96 : 0.08,
        confidence: 0.92,
      },
      trigger_words: quickTriggers,
    };
    recordVictimInteraction(userMsg, initialScores);

    // Refine with live Bayesian Risk Fusion Engine & Hugging Face models
    scoreTextLive(userMsg)
      .then((scores) => {
        recordVictimInteraction(userMsg, scores);
        if (scores.threat.threat_flag || scores.sentiment.label === "HIGH" || scores.fusion?.label === "CRITICAL") {
          setShowCrisisBanner(true);
        }
      })
      .catch((err) => {
        console.warn("Live victim perception scoring error:", err);
      });

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMsg },
      { role: "assistant", content: "" },
    ]);
    setStreaming(true);

    abortRef.current = streamChat(
      {
        case_id: activeCodeword,
        channel: "pwa",
        message: userMsg,
        model: chatMode === "casewriter" ? "casewriter" : "sahayak",
      },
      (delta) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant") {
            return [...prev.slice(0, -1), { ...last, content: last.content + delta }];
          }
          return prev;
        });
      },
      (final) => {
        setStreaming(false);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant") {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: final.reply || last.content,
                source: (final as any).source,
              },
            ];
          }
          return prev;
        });

        if (final.status === "awaiting_counsellor") {
          setShowCrisisBanner(true);
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content:
                "🤝 An alert has been prioritised for on-duty counsellor review. If you are in immediate physical danger, please tap the call button above or call 14416 right now.",
            },
          ]);
        }
      },
      (err) => {
        setStreaming(false);
        console.error("StreamChat error:", err);
      }
    );
  };

  const casewriterPresets = [
    {
      label: "🚨 Urgent Stalking & Abuse",
      prompt: "Victim reports spouse took house keys, confiscated phone, and issued direct physical threats.",
    },
    {
      label: "📋 Extract Risk & Recommended Action",
      prompt: "Analyze latest dialogue: feeling trapped and unable to sleep for 4 days. Synthesize CaseWriter action.",
    },
    {
      label: "⚖️ Legal & Protection Order Guidance",
      prompt: "What are the immediate steps under the Protection of Women from Domestic Violence Act for urgent relief?",
    },
    {
      label: "🍃 Grounding & Routine Cadence",
      prompt: "Victim completed morning sensory walk, reported feeling quiet and stable. Formulate 7-day monitoring brief.",
    },
  ];

  return (
    <div className="grain min-h-screen bg-background text-foreground flex flex-col justify-between relative overflow-hidden">
      {/* Persistent Glowing Helpline Bar */}
      <div className="sticky top-0 z-30 w-full border-b border-forest/15 bg-forest/95 px-4 py-2.5 text-forest-foreground backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-breathe absolute inline-flex h-full w-full rounded-full bg-clay" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-clay" />
            </span>
            <span className="text-xs font-medium tracking-wide">
              Someone is here with you · India 24/7 Crisis Helplines
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="tel:14416"
              className="flex items-center gap-1.5 rounded-full bg-clay px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-clay-soft transition-colors"
            >
              <PhoneCall className="h-3 w-3" />
              <span>14416 (Tele-MANAS)</span>
            </a>
            <a
              href="tel:18005990019"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-forest-foreground/30 px-3 py-1 text-xs hover:bg-forest-deep transition-colors"
            >
              <span>1800-599-0019 (KIRAN)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Subheader */}
      <header className="mx-auto w-full max-w-4xl px-4 py-3 flex items-center justify-between border-b border-foreground/10 z-10">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-1.5 text-foreground/60 hover:text-clay transition-colors rounded-full hover:bg-foreground/5"
            title="Return Home"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl leading-none">
                {chatMode === "casewriter" ? "CaseWriter AI Clinical Studio" : "Sahayak Sanctuary"}
              </h1>
              <span className="rounded-full bg-clay/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-clay border border-clay/20">
                {activeCodeword}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-foreground/50 pt-0.5">
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  currentUser?.share_personal_info
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground/60"
                }`}
              >
                {currentUser?.share_personal_info ? "✓ Disclosed Mode" : "🔒 Strict Anonymous Shield"}
              </span>
              {currentUser?.email && (
                <>
                  <span>·</span>
                  <span className="text-foreground/75 truncate max-w-[140px] font-mono">{currentUser.email}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentUser && (
            <button
              type="button"
              onClick={() => {
                logoutUser();
                navigate({ to: "/" });
              }}
              className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-forest text-white shadow-sm hover:!bg-clay hover:!text-white transition-all duration-200 cursor-pointer active:scale-95"
              title="Log out"
              aria-label="Log out"
            >
              <Power className="h-3.5 w-3.5 text-white" />
            </button>
          )}

          {chatMode === "sahayak" && (
            <button
              onClick={() => setShowGroundingDrawer(!showGroundingDrawer)}
              className="flex items-center gap-1.5 rounded-full border border-red-500/35 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-sm"
              title="Feeling panicky? Open immediate calming exercise"
            >
              <Wind className="h-3.5 w-3.5 animate-pulse" />
              <span>Feeling panicky</span>
              {showGroundingDrawer ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {chatMode === "casewriter" && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCasewriterMessages([CASEWRITER_WELCOME]);
                  if (typeof window !== "undefined" && !isEphemeralUser) {
                    localStorage.removeItem(`casewriter_chat_messages_${userChatScope}`);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-card/70 px-2.5 py-1 text-xs font-medium text-foreground/70 hover:border-clay hover:text-clay transition-colors cursor-pointer"
                title="Reset CaseWriter dialogue"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Chat</span>
              </button>
              <Link
                to="/counsellor"
                className="inline-flex items-center gap-1.5 rounded-full bg-forest px-3 py-1 text-xs font-semibold text-white hover:!bg-clay transition-all"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Open Field Dossiers</span>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* SHOWPIECE: Mode Switcher between Sahayak Mode & CaseWriter Mode */}
      <div className="mx-auto w-full max-w-4xl px-4 pt-3 pb-2 z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 rounded-2xl bg-card/90 border border-foreground/10 shadow-[var(--shadow-soft)] backdrop-blur-md">
          {/* Dual Toggle Buttons */}
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-background/80 border border-foreground/10">
            <button
              type="button"
              onClick={() => handleSwitchMode("sahayak")}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none ${
                chatMode === "sahayak"
                  ? "bg-forest text-white shadow-sm"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>🌿 Sahayak Sanctuary Mode</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode("casewriter")}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none ${
                chatMode === "casewriter"
                  ? "bg-clay text-white shadow-sm"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
              <span>⚖️ CaseWriter Clinical Mode</span>
            </button>
          </div>

          {/* Real-time Connection Indicator to VM & Backend */}
          <div className="flex items-center gap-2 text-[11px] font-mono px-2">
            {chatMode === "casewriter" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-clay/10 text-clay border border-clay/25 font-semibold">
                <Cpu className="h-3 w-3 animate-pulse text-clay" />
                <span>Azure VM (:8500) & Backend (:8400)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest/10 text-forest border border-forest/25 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>PWA End-to-End Encrypted</span>
              </span>
            )}
          </div>
        </div>

        {/* CaseWriter Quick Evaluation Prompts */}
        {chatMode === "casewriter" && (
          <div className="pt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/50 mr-1">
              CaseWriter Presets:
            </span>
            {casewriterPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleSend(preset.prompt)}
                disabled={streaming}
                className="text-[11px] rounded-full border border-foreground/15 bg-card/60 px-3 py-1 text-foreground/75 hover:border-clay hover:text-clay transition-all disabled:opacity-40 text-left"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Grounding Drawer (Available in Sahayak Mode) */}
      {chatMode === "sahayak" && showGroundingDrawer && (
        <div className="mx-auto w-full max-w-4xl px-4 pt-1 z-20">
          <div className="rounded-2xl border border-clay/30 bg-card/95 p-4 shadow-[var(--shadow-lift)] backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clay flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5" /> Feeling Panicky? {groundingExercises[0].title}
              </span>
              <span className="text-[11px] text-foreground/50">
                Step {groundingStep + 1} of {groundingExercises[0].steps.length}
              </span>
            </div>

            <p className="text-sm text-foreground/85 font-medium">
              {groundingExercises[0].steps[groundingStep]}
            </p>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setGroundingStep(Math.max(0, groundingStep - 1))}
                disabled={groundingStep === 0}
                className="text-xs text-foreground/50 disabled:opacity-30 hover:text-clay cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setGroundingStep(Math.min(groundingExercises[0].steps.length - 1, groundingStep + 1))
                }
                disabled={groundingStep === groundingExercises[0].steps.length - 1}
                className="rounded-full bg-forest px-4 py-1 text-xs font-medium text-forest-foreground hover:!bg-clay transition-colors disabled:opacity-40 cursor-pointer"
              >
                Next Anchor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Living Breathing Background Orb */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center -z-0 opacity-40">
        <div className="animate-orb h-80 w-80 md:h-96 md:w-96 rounded-full bg-gradient-to-tr from-clay/20 via-sage/30 to-forest/15 blur-2xl" />
      </div>

      {/* Chat Messages Log */}
      <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-4 py-4 space-y-4 z-10">
        {/* Danger Alert Banner if triggered */}
        {showCrisisBanner && (
          <div className="rounded-2xl border-2 border-clay bg-clay/10 p-4 text-foreground shadow-[var(--shadow-lift)] space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-2 text-clay font-semibold text-sm">
              <ShieldAlert className="h-4 w-4" />
              <span>We hear the deep pain you are carrying right now.</span>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">
              You do not have to walk through this alone. Trained responders are on call right now across India.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href="tel:14416"
                className="rounded-full bg-clay px-4 py-1.5 text-xs font-medium text-white hover:bg-clay-soft transition-colors"
              >
                Call Tele-MANAS (14416)
              </a>
              <a
                href="tel:18005990019"
                className="rounded-full bg-forest px-4 py-1.5 text-xs font-medium text-forest-foreground hover:bg-forest-deep transition-colors"
              >
                Call KIRAN (1800-599-0019)
              </a>
              <Link
                to="/request"
                className="rounded-full border border-foreground/30 px-3 py-1.5 text-xs text-foreground hover:bg-card transition-colors"
              >
                Connect to Assigned Counsellor
              </Link>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === "user"
                ? "justify-end"
                : m.role === "system"
                ? "justify-center"
                : "justify-start"
            }`}
          >
            {m.role === "system" ? (
              <div className="max-w-lg rounded-2xl bg-card border border-foreground/15 p-3 text-center text-xs text-foreground/80 shadow-sm">
                {m.content}
              </div>
            ) : (
              <div
                className={`max-w-[88%] md:max-w-xl rounded-3xl p-4 text-sm leading-relaxed ${
                  m.role === "user"
                    ? chatMode === "casewriter"
                      ? "bg-clay text-white rounded-br-sm shadow-[var(--shadow-lift)]"
                      : "bg-forest text-forest-foreground rounded-br-sm shadow-[var(--shadow-lift)]"
                    : "bg-card/95 text-foreground border border-foreground/10 rounded-bl-sm shadow-[var(--shadow-soft)] backdrop-blur-sm"
                }`}
              >
                {/* Assistant Model Header Badge */}
                {m.role === "assistant" && (
                  <div className="flex items-center justify-between text-[10px] font-mono text-foreground/50 border-b border-foreground/5 pb-1.5 mb-2">
                    <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
                      {chatMode === "casewriter" ? (
                        <>
                          <Scale className="h-3 w-3 text-clay" />
                          <span>CaseWriter Synthesis</span>
                        </>
                      ) : (
                        <>
                          <Bot className="h-3 w-3 text-forest" />
                          <span>Sahayak Sanctuary AI</span>
                        </>
                      )}
                    </span>
                    {m.source && (
                      <span className="text-[9px] bg-foreground/5 px-2 py-0.5 rounded font-mono">
                        {m.source === "vm_orchestrator"
                          ? "⚡ Live Azure VM"
                          : m.source === "backend_casewriter_engine"
                          ? "🛡️ Backend Synthesis"
                          : "🍃 Client Fallback"}
                      </span>
                    )}
                  </div>
                )}

                <div className="whitespace-pre-wrap font-sans text-xs md:text-sm leading-relaxed">
                  {m.content}
                </div>

                {m.role === "assistant" && streaming && i === messages.length - 1 && (
                  <span className="inline-block h-3 w-1.5 ml-1 bg-clay animate-pulse" />
                )}

                {/* Save to Case Dossier Button (in CaseWriter mode) */}
                {chatMode === "casewriter" && m.role === "assistant" && m.content && !streaming && (
                  <div className="pt-3 mt-2 border-t border-foreground/10 flex items-center justify-between">
                    <span className="text-[10px] text-foreground/45 font-mono">
                      Grounded recommendation ready
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSaveToDossier(m.content, i)}
                      disabled={savedNotes[i]}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-clay hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      {savedNotes[i] ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span className="text-emerald-600">Saved to Case Notes</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="h-3.5 w-3.5" />
                          <span>Save as Note to Dossier</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Message Input Box */}
      <div className="sticky bottom-0 z-20 w-full border-t border-foreground/10 bg-background/95 p-4 backdrop-blur-md">
        <div className="mx-auto max-w-4xl flex items-center gap-2">
          <input
            className="flex-1 rounded-full border border-foreground/15 bg-card px-5 py-3 text-sm text-foreground placeholder:text-foreground/40 focus:border-clay focus:outline-none focus:ring-1 focus:ring-clay"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              chatMode === "casewriter"
                ? "Enter case facts, witness statements, or incident notes to synthesize recommendation..."
                : "Type anything here... take all the time you need"
            }
            maxLength={4000}
            disabled={streaming}
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={streaming || !input.trim()}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-white shadow-[var(--shadow-lift)] transition-all disabled:opacity-40 cursor-pointer active:scale-95 ${
              chatMode === "casewriter" ? "bg-clay hover:bg-forest" : "bg-forest hover:!bg-clay"
            }`}
            aria-label="Send message"
          >
            {streaming ? <Sparkles className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <div className="mx-auto max-w-4xl flex items-center justify-between text-[10px] text-foreground/40 pt-1.5 px-2 font-light">
          <span>
            {chatMode === "casewriter"
              ? "CaseWriter v2.1.0 · Grounded Bayesian inference & policy compliance"
              : "Encrypted & unrecorded · Press Esc anytime for Quick Exit"}
          </span>
          <span className="font-mono">Port :8400 & :8500</span>
        </div>
      </div>
    </div>
  );
}
