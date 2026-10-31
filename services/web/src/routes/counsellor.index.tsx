import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  getCases,
  getRegisteredVictims,
  RegisteredVictimRecord,
  syncBackendVictimsToLocalStorage,
  updateCaseStatus,
  addCaseNote,
  subscribeToStore,
  CounsellorCase,
  getCurrentUser,
  logoutUser,
} from "@/lib/store";
import { BASE } from "@/lib/api";
import { TimelineOverlay } from "@/components/counsellor/TimelineOverlay";
import { scoreTextLive, LiveScoreResult } from "@/lib/api";
import {
  Folder,
  User,
  FileText,
  Clock,
  HeartHandshake,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Send,
  Layers,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  Sparkles,
  EyeOff,
  Lock,
  Power,
  Zap,
  Radio,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Mic,
  Phone,
  Hash,
  Heart,
  Camera,
} from "lucide-react";

export const Route = createFileRoute("/counsellor/")({
  head: () => ({
    meta: [{ title: "Counsellor Field Office — Sahayak" }],
  }),
  component: CounsellorDashboardPage,
});

export default function CounsellorDashboardPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [cases, setCases] = useState<CounsellorCase[]>([]);
  const [registeredVictims, setRegisteredVictims] = useState<RegisteredVictimRecord[]>([]);
  const [counsellorTab, setCounsellorTab] = useState<"dossiers" | "victims">("victims");
  const [selectedCase, setSelectedCase] = useState<CounsellorCase | null>(null);
  const [activeDossierIndex, setActiveDossierIndex] = useState(0);
  const [fullChatTurns, setFullChatTurns] = useState<{ role: string; content: string }[]>([]);
  const [newNote, setNewNote] = useState("");
  const [scoringInput, setScoringInput] = useState("I cannot take this anymore, they are following me");
  const [isScoring, setIsScoring] = useState(false);
  const [liveResult, setLiveResult] = useState<LiveScoreResult | null>(null);
  const shelfScrollRef = useRef<HTMLDivElement>(null);

  const navigateDossier = (direction: "left" | "right") => {
    if (!cases || cases.length === 0) return;
    const currentIdx = cases.findIndex(
      (c) => c.id === selectedCase?.id || c.case_id === selectedCase?.case_id
    );
    const validCurrent = currentIdx >= 0 ? currentIdx : activeDossierIndex;

    let nextIndex = 0;
    if (direction === "right") {
      nextIndex = (validCurrent + 1) % cases.length;
    } else {
      nextIndex = (validCurrent - 1 + cases.length) % cases.length;
    }

    setActiveDossierIndex(nextIndex);
    const nextCase = cases[nextIndex];
    if (nextCase) {
      setSelectedCase(nextCase);
    }
  };

  // Fetch backend DB victims and persist to localStorage (survives heartbeat resets)
  const fetchBackendVictims = async () => {
    try {
      const res = await fetch(`${BASE}/api/v1/auth/victims`);
      if (res.ok) {
        const backendVictims: RegisteredVictimRecord[] = await res.json();
        // Write into localStorage so getCases() / getRegisteredVictims() pick them up
        // on every heartbeat tick - avoids the 3s reset problem
        syncBackendVictimsToLocalStorage(backendVictims);
      }
    } catch {
      // Backend unavailable - localStorage-only mode
    }
  };

  useEffect(() => {
    setMounted(true);
    const refresh = () => {
      setCurrentUser(getCurrentUser());
      const localVictims = getRegisteredVictims();
      setRegisteredVictims(localVictims);
      const list = getCases();
      setCases(list);
      setSelectedCase((current) => {
        if (!current && list.length > 0) {
          setActiveDossierIndex(0);
          return list[0];
        }
        if (current) {
          const matchingIdx = list.findIndex((c) => c.id === current.id || c.case_id === current.case_id);
          if (matchingIdx >= 0) {
            setActiveDossierIndex(matchingIdx);
            return list[matchingIdx];
          }
          setActiveDossierIndex(0);
          return list[0] || null;
        }
        return null;
      });
    };

    refresh();
    fetchBackendVictims();
    const unsubscribe = subscribeToStore(refresh);
    const backendTimer = setInterval(() => {
      fetchBackendVictims();
    }, 15000);
    return () => {
      unsubscribe();
      clearInterval(backendTimer);
    };
  }, []);

  useEffect(() => {
    const loadChat = () => {
      if (typeof window === "undefined" || !selectedCase?.codeword) {
        setFullChatTurns([]);
        return;
      }
      try {
        const raw = localStorage.getItem(`sahayak_chat_messages_${selectedCase.codeword}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setFullChatTurns(parsed.filter((m) => m && (typeof m.content === "string" || m.content)));
            return;
          }
        }
      } catch {}
      setFullChatTurns([]);
    };

    loadChat();
    if (typeof window !== "undefined") {
      window.addEventListener("sahayak_store_updated", loadChat);
      window.addEventListener("storage", loadChat);
      return () => {
        window.removeEventListener("sahayak_store_updated", loadChat);
        window.removeEventListener("storage", loadChat);
      };
    }
  }, [selectedCase?.codeword]);

  const handleStatusChange = (status: CounsellorCase["status"]) => {
    if (!selectedCase) return;
    updateCaseStatus(selectedCase.id, status);
    const updated = getCases();
    setCases(updated);
    const refreshed = updated.find((c) => c.id === selectedCase.id);
    if (refreshed) setSelectedCase(refreshed);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !newNote.trim()) return;
    addCaseNote(selectedCase.id, newNote);
    setNewNote("");
    const updated = getCases();
    setCases(updated);
    const refreshed = updated.find((c) => c.id === selectedCase.id);
    if (refreshed) setSelectedCase(refreshed);
  };

  const handleRunLiveScoring = async () => {
    if (!scoringInput.trim() || isScoring) return;
    setIsScoring(true);
    try {
      const res = await scoreTextLive(scoringInput);
      setLiveResult(res);
      // If a case is selected, dynamically update its live perception scores with this real model inference!
      if (selectedCase) {
        const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const updatedTrajectory = [
          ...selectedCase.distress_trajectory,
          {
            date: "Today " + nowTime,
            score: res.composite_score,
            event: `Live Perception Inference (${res.sentiment.label})`,
          },
        ];

        const updatedCase: CounsellorCase = {
          ...selectedCase,
          distress_trajectory: updatedTrajectory,
          ml_scores: {
            sentiment_label: res.sentiment.label,
            sentiment_score: Number(res.sentiment.sentiment_score.toFixed(2)),
            threat_flag: res.threat.threat_flag,
            threat_prob: Number(res.threat.prob.toFixed(2)),
            voice_stress_score: selectedCase.ml_scores?.has_voice_recording ? selectedCase.ml_scores.voice_stress_score : undefined,
            voice_label: selectedCase.ml_scores?.has_voice_recording ? selectedCase.ml_scores.voice_label : undefined,
            has_voice_recording: selectedCase.ml_scores?.has_voice_recording || false,
            composite_score: res.composite_score,
            confidence: Number(((res.sentiment.confidence + res.threat.confidence) / 2).toFixed(2)),
            trend_flag: res.threat.threat_flag || res.sentiment.label === "HIGH" ? "ESCALATING" : "STABLE",
          },
        };
        setSelectedCase(updatedCase);
      }
    } finally {
      setIsScoring(false);
    }
  };

  const handleLogScoreAsNote = () => {
    if (!selectedCase || !liveResult) return;
    const noteText = `[AI Perception Evidence · ${liveResult.source === "live_huggingface_service" ? "Live HF Models" : "Calibrated"}] Evaluated: "${scoringInput}" → Distress: ${liveResult.sentiment.label} (${(liveResult.sentiment.sentiment_score * 100).toFixed(0)}%), Threat: ${liveResult.threat.threat_flag ? "FLAGGED" : "CLEAR"} (P=${(liveResult.threat.prob * 100).toFixed(0)}%).`;
    addCaseNote(selectedCase.id, noteText, "AI Perception Engine");
    const updated = getCases();
    setCases(updated);
    const refreshed = updated.find((c) => c.id === selectedCase.id);
    if (refreshed) setSelectedCase(refreshed);
  };

  const getStatusStep = (status: CounsellorCase["status"]) => {
    switch (status) {
      case "new":
        return 1;
      case "contacted":
        return 2;
      case "in_support":
        return 3;
      case "resolved":
        return 4;
      default:
        return 1;
    }
  };

  const criticalCases = (cases || []).filter(
    (c) =>
      c?.triage_priority?.startsWith("P1") ||
      c?.ml_scores?.threat_flag ||
      c?.ml_scores?.trend_flag === "ESCALATING"
  );

  return (
    <div className="grain min-h-screen bg-background text-foreground p-6 md:p-12">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Top Field Office Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-foreground/10 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-clay">
              <Stethoscope className="h-3.5 w-3.5" />
              <span>Counsellor Field Office · Dr. Ananya Roy</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-display">Assigned Case Records</h1>
            <p className="text-sm text-foreground/60">
              Tactile manila case files with timeline distress tracking and field clinical notes.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <Link
              to="/counsellor/alerts"
              className="inline-flex items-center gap-2 rounded-full border border-clay bg-clay/10 px-5 py-2.5 text-xs font-semibold text-clay hover:bg-clay hover:text-white transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Triage Alert Queue</span>
              {criticalCases.length > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {criticalCases.length}
                </span>
              )}
            </Link>
            <Link
              to="/counsellor/trace/$threadId"
              params={{ threadId: selectedCase?.case_id || "thread-8492" }}
              className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-xs font-semibold text-forest-foreground hover:bg-clay transition-colors"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Inspect AI Trace</span>
            </Link>

            {mounted && currentUser && (
              <div className="flex items-center gap-2 rounded-full border border-foreground/15 bg-card/90 pl-3 pr-1.5 py-1 text-xs">
                <span className="font-mono text-foreground/75 text-[11px] truncate max-w-[120px]">
                  {currentUser.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    logoutUser();
                    navigate({ to: "/" });
                  }}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-forest text-white shadow-sm transition-all duration-200 cursor-pointer active:scale-95 hover:!bg-clay hover:!text-white"
                  title="Log out"
                  aria-label="Log out"
                >
                  <Power className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            )}
          </div>
        </div>



        {/* Tab Switcher: Assigned Dossiers vs Victims Intake Directory */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-card/80 border border-foreground/10 rounded-2xl shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-1.5 p-1 bg-background/80 rounded-xl border border-foreground/10">
            <button
              type="button"
              onClick={() => setCounsellorTab("dossiers")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                counsellorTab === "dossiers"
                  ? "bg-forest text-white shadow-sm"
                  : "text-foreground/70 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <Folder className="h-3.5 w-3.5" />
              <span>Assigned Case Dossiers</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                counsellorTab === "dossiers" ? "bg-white/20 text-white" : "bg-forest/15 text-forest"
              }`}>
                {cases.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCounsellorTab("victims")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                counsellorTab === "victims"
                  ? "bg-clay text-white shadow-sm"
                  : "text-foreground/70 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <HeartHandshake className="h-3.5 w-3.5" />
              <span>Victims Intake Directory</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                counsellorTab === "victims" ? "bg-white/20 text-white" : "bg-clay/15 text-clay"
              }`}>
                {registeredVictims.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 px-3 text-xs text-foreground/55 font-mono">
            <span>Live Sync Active</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        {counsellorTab === "victims" ? (
          /* VICTIMS INTAKE DIRECTORY VIEW: Shows every single piece of gathered info, and "No info" for what wasn't gathered */
          <div className="rounded-3xl border border-foreground/15 bg-card p-6 md:p-8 space-y-6 shadow-[var(--shadow-soft)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-foreground/10 pb-4">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-clay flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-clay animate-pulse" /> Comprehensive Victim Intake Registry
                </span>
                <h2 className="font-display text-2xl text-foreground">
                  Victim Registration Profiles ({registeredVictims.length})
                </h2>
                <p className="text-xs text-foreground/60">
                  Full intelligence record of all individuals signing up as victims. Ungathered fields are strictly marked "No info".
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-foreground/10 text-foreground/50 uppercase tracking-wider font-mono text-[10px]">
                    <th className="pb-3 pr-3">Name / Victim ID</th>
                    <th className="pb-3 px-3">Email Address</th>
                    <th className="pb-3 px-3">Contact Phones</th>
                    <th className="pb-3 px-3">Sign-Up Method</th>
                    <th className="pb-3 px-3">Keypad Code</th>
                    <th className="pb-3 px-3">Codeword</th>
                    <th className="pb-3 px-3">Sharing Consent</th>
                    <th className="pb-3 px-3">Biometrics / Stress</th>
                    <th className="pb-3 pl-3 text-right">Action / Dossier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/5">
                  {registeredVictims.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-foreground/45 italic">
                        No registered victims found in registry.
                      </td>
                    </tr>
                  ) : (
                    registeredVictims.map((v) => {
                      const hasName = Boolean(v.name && v.name.trim() && v.name !== "Anonymous Traveler" && v.name !== "Cam-Verified Traveler");
                      const hasEmail = Boolean(v.email && v.email.trim() && !v.email.includes("@sahayak.gov.in"));
                      const hasPhone = Boolean(v.phone && v.phone.trim() && v.phone !== "+919876543210");
                      const hasClosePhone = Boolean(v.close_phone && v.close_phone.trim());
                      const hasKeypad = Boolean(v.keypad_code && v.keypad_code.trim());
                      const hasCodeword = Boolean(v.codeword && v.codeword.trim());
                      const hasVoiceScore = typeof v.voice_stress_score === "number";
                      const hasCamScore = typeof v.camera_distress_score === "number" || Boolean(v.primary_emotion);

                      return (
                        <tr key={v.id || v.user_id} className="hover:bg-foreground/[0.02] transition-colors">
                          <td className="py-3.5 pr-3">
                            <div className="font-semibold text-foreground">
                              {hasName ? v.name : <span className="px-2 py-0.5 rounded bg-foreground/5 text-foreground/40 italic font-mono text-[10px]">No info</span>}
                            </div>
                            <span className="text-[10px] text-foreground/40 font-mono block">
                              ID: {v.user_id || "No info"}
                            </span>
                          </td>

                          <td className="py-3.5 px-3">
                            {hasEmail ? (
                              <span className="font-mono text-foreground/80">{v.email}</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-foreground/5 text-foreground/40 italic font-mono text-[10px]">No info</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="space-y-0.5 font-mono text-[11px]">
                              <div>
                                <span className="text-[10px] text-foreground/40 block">Primary:</span>
                                {hasPhone ? (
                                  <span className="text-forest font-medium">{v.phone}</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-foreground/5 text-foreground/40 italic font-mono text-[10px]">No info</span>
                                )}
                              </div>
                              <div>
                                <span className="text-[10px] text-foreground/40 block">Close Contact:</span>
                                {hasClosePhone ? (
                                  <span className="text-clay font-medium">{v.close_phone}</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-foreground/5 text-foreground/40 italic font-mono text-[10px]">No info</span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                                v.auth_method === "opencv_camera"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                  : v.auth_method === "voice_keypad"
                                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                                  : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                              }`}
                            >
                              {v.auth_method === "opencv_camera" ? (
                                <>
                                  <Camera className="h-3 w-3" />
                                  <span>OpenCV Face</span>
                                </>
                              ) : v.auth_method === "voice_keypad" ? (
                                <>
                                  <Phone className="h-3 w-3" />
                                  <span>Voice Keypad</span>
                                </>
                              ) : (
                                <>
                                  <FileText className="h-3 w-3" />
                                  <span>Traditional Web</span>
                                </>
                              )}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 font-mono">
                            {hasKeypad ? (
                              <span className="text-clay font-bold bg-clay/10 px-2 py-0.5 rounded border border-clay/20 text-[11px]">{v.keypad_code}</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-foreground/5 text-foreground/40 italic text-[10px]">No info</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 font-mono">
                            {hasCodeword ? (
                              <span className="text-foreground font-semibold">{v.codeword}</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-foreground/5 text-foreground/40 italic text-[10px]">No info</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                                v.share_personal_info
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                  : "bg-foreground/10 text-foreground/60 border border-foreground/15"
                              }`}
                            >
                              {v.share_personal_info ? "Disclosed" : "Strict Shield"}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 font-mono text-[11px]">
                            <div className="space-y-0.5">
                              <div>
                                <span className="text-[10px] text-foreground/40 block">Voice Stress:</span>
                                {hasVoiceScore ? (
                                  <span className="text-purple-700 dark:text-purple-300 font-bold">
                                    {Math.round(v.voice_stress_score! * 100)}% ({v.voice_label || "Score"})
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded bg-foreground/5 text-foreground/40 italic text-[10px]">No info</span>
                                )}
                              </div>
                              <div>
                                <span className="text-[10px] text-foreground/40 block">Face Emotion:</span>
                                {hasCamScore ? (
                                  <span className="text-amber-600 font-bold capitalize">
                                    {v.primary_emotion || "Detected"} ({Math.round((v.camera_distress_score || 0.35) * 100)}%)
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded bg-foreground/5 text-foreground/40 italic text-[10px]">No info</span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 pl-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                const target = cases.find(
                                  (c) =>
                                    c.id === v.user_id ||
                                    c.id === v.id ||
                                    c.id === `backend-${v.id}` ||
                                    c.id === `backend-${v.user_id}` ||
                                    c.case_id === v.case_id ||
                                    (v.codeword && c.codeword === v.codeword) ||
                                    (v.email && c.victim_profile?.email?.toLowerCase() === v.email.toLowerCase()) ||
                                    (v.name && c.victim_profile?.name?.toLowerCase() === v.name.toLowerCase())
                                );
                                if (target) {
                                  setSelectedCase(target);
                                  const targetIdx = cases.findIndex((c) => c.id === target.id);
                                  if (targetIdx >= 0) setActiveDossierIndex(targetIdx);
                                  setCounsellorTab("dossiers");
                                } else {
                                  const newCw = v.codeword || (v.name ? v.name.toLowerCase().replace(/\s+/g, "-").slice(0, 12) + `-${v.id.slice(0, 4)}` : `intake-${v.id.slice(0, 8)}`);
                                  const newDossier: CounsellorCase = {
                                    id: `backend-${v.id}`,
                                    case_id: `backend-${v.id.slice(0, 8)}`,
                                    codeword: newCw,
                                    triage_priority: "P3 - Routine",
                                    status: "new",
                                    share_personal_info: v.share_personal_info ?? true,
                                    victim_profile: {
                                      name: v.name,
                                      email: v.email,
                                      phone: v.phone,
                                      close_phone: v.close_phone,
                                      keypad_code: v.keypad_code,
                                    },
                                    distress_trajectory: [{ date: "Intake", score: 0.3, event: "Intake registered" }],
                                    fieldNotes: [
                                      {
                                        id: `fn-${v.id}`,
                                        timestamp: v.registered_at || "Recent",
                                        author: "Intake Desk",
                                        text: `Dossier opened for ${v.name || "Victim"} via ${v.auth_method || "portal"}.`,
                                      },
                                    ],
                                    interaction_history: [
                                      {
                                        id: `ih-${v.id}`,
                                        timestamp: v.registered_at || "Recent",
                                        text: `Intake established via ${v.auth_method || "portal"}.`,
                                        source: "intake",
                                        risk_level: "LOW",
                                        modality: v.latest_modality || "text used",
                                      },
                                    ],
                                    latest_modality: v.latest_modality || "text used",
                                    signals: [
                                      v.share_personal_info ? "Personal Info Disclosed" : "Strict Anonymous Shield",
                                      "PWA Secure",
                                    ],
                                    summary: `Victim ${v.name || "profile"} intake record.`,
                                    last_interaction: v.registered_at || "Recent",
                                    created_at: v.registered_at || "Recent",
                                    ml_scores: {
                                      sentiment_label: "LOW",
                                      sentiment_score: 0.3,
                                      threat_flag: false,
                                      threat_prob: 0.1,
                                      composite_score: 0.28,
                                      confidence: 0.8,
                                      trend_flag: "STABLE",
                                    },
                                  };
                                  setCases((prev) => [newDossier, ...prev]);
                                  setSelectedCase(newDossier);
                                  setActiveDossierIndex(0);
                                  setCounsellorTab("dossiers");
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1 text-[11px] font-semibold text-white hover:bg-clay transition-all cursor-pointer shadow-sm"
                            >
                              <span>Open Dossier</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
        /* Main Work Area: Horizontal Dossier Shelf + Active Selected Case Below */
        <div className="space-y-6">
          {/* Top Section: Horizontal Assigned Dossiers Shelf */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-clay" />
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                  Assigned Dossiers ({cases.length})
                </span>
              </div>
              {/* Go Left / Go Right Navigation Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => navigateDossier("left")}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-forest text-white font-mono text-xs font-bold shadow-sm transition-all duration-200 cursor-pointer select-none active:scale-95 hover:!bg-clay hover:!text-white"
                  title="Previous Dossier"
                  aria-label="Previous Dossier"
                >
                  {"<"}
                </button>
                <span className="font-mono text-[11px] text-foreground/55 px-1 select-none font-semibold">
                  {activeDossierIndex + 1}/{cases.length || 1}
                </span>
                <button
                  type="button"
                  onClick={() => navigateDossier("right")}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-forest text-white font-mono text-xs font-bold shadow-sm transition-all duration-200 cursor-pointer select-none active:scale-95 hover:!bg-clay hover:!text-white"
                  title="Next Dossier"
                  aria-label="Next Dossier"
                >
                  {">"}
                </button>
              </div>
            </div>

            {/* Horizontal Sliding Carousel / Shelf that physically moves left and right */}
            <div className="w-full overflow-hidden relative py-2 px-1 sm:px-2">
              <div
                className="flex gap-4 pb-2 pt-1 pl-1.5 transition-transform duration-500 ease-out will-change-transform"
                style={{
                  transform: `translateX(calc(-1 * ${activeDossierIndex} * (min(20rem, 75vw) + 1rem)))`,
                }}
              >
                {cases.map((c, idx) => {
                  const isSelected = selectedCase?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCase(c);
                        setActiveDossierIndex(idx);
                      }}
                      className={`shrink-0 w-[min(20rem,75vw)] rounded-2xl border p-4.5 transition-all duration-300 cursor-pointer relative overflow-hidden select-none ${
                        isSelected
                          ? "border-clay bg-card shadow-[var(--shadow-lift)] ring-2 ring-clay/40 -translate-y-1 scale-[1.01]"
                          : "border-foreground/10 bg-card/60 hover:bg-card hover:border-foreground/20 hover:-translate-y-0.5 opacity-85 hover:opacity-100"
                      }`}
                    >
                    {/* Paper file top tab effect */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Folder className={`h-4 w-4 shrink-0 ${isSelected ? "text-clay" : "text-foreground/40"}`} />
                        <span className="font-mono text-sm font-bold text-foreground truncate">
                          {c.codeword}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          c.triage_priority?.startsWith("P1")
                            ? "bg-red-500/15 text-red-700 dark:text-red-400"
                            : c.triage_priority?.startsWith("P2")
                            ? "bg-clay/15 text-clay"
                            : "bg-sage/30 text-sage-deep"
                        }`}
                      >
                        {c.triage_priority || "P3 - Routine"}
                      </span>
                    </div>

                    {/* Prominent Victim Name in Dossier Card */}
                    <div className="text-xs font-semibold text-foreground/90 mb-1.5 truncate flex items-center gap-1">
                      {c.victim_profile?.name ? (
                        <span className="text-forest dark:text-emerald-400 font-bold flex items-center gap-1 truncate">
                          <User className="h-3 w-3 shrink-0 text-forest" />
                          <span>{c.victim_profile.name}</span>
                          {c.victim_profile.phone && (
                            <span className="text-[10px] text-foreground/45 font-mono font-normal">
                              ({c.victim_profile.phone})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-foreground/45 italic text-[11px]">
                          {c.share_personal_info ? "Anonymous Victim" : "Shielded Identity"}
                        </span>
                      )}
                    </div>

                    {/* Modality Tag & Keypad Sequence */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span
                        className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${
                          c.latest_modality === "camera used"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                            : c.latest_modality === "voice used"
                            ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                            : "bg-forest/15 text-forest border border-forest/20"
                        }`}
                      >
                        {c.latest_modality === "camera used" ? (
                          <>
                            <Camera className="h-2.5 w-2.5" />
                            <span>Camera Used</span>
                          </>
                        ) : c.latest_modality === "voice used" ? (
                          <>
                            <Mic className="h-2.5 w-2.5" />
                            <span>Voice Used</span>
                          </>
                        ) : (
                          <>
                            <FileText className="h-2.5 w-2.5" />
                            <span>Text Used</span>
                          </>
                        )}
                      </span>
                      {c.keypad_code && (
                        <span className="text-[9px] font-mono text-clay bg-clay/10 px-1.5 py-0.5 rounded-md border border-clay/20 font-semibold">
                          #{c.keypad_code}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-foreground/70 line-clamp-2 leading-relaxed mb-3 min-h-[2.2rem]">
                      {c.share_personal_info === false ? (
                        <span className="italic text-foreground/45 flex items-center gap-1.5 font-mono text-[11px]">
                          <EyeOff className="h-3 w-3" /> [Confidential chat text shielded by victim]
                        </span>
                      ) : (
                        c.summary?.trim() && c.summary !== "No chat dialogue recorded yet." ? c.summary : "not taken chat"
                      )}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-foreground/50 border-t border-foreground/10 pt-2.5 font-mono">
                      <span>Status: <strong className="capitalize text-foreground/80">{(c.status || "new").replace("_", " ")}</strong></span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {c.last_interaction || "Recent"}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-clay rounded-full" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Section: Active Dossier & Field Notebook (Rendered Full Width Below) */}
          <div className="w-full">
            {selectedCase ? (
              <div className="rounded-3xl border border-foreground/15 bg-card p-6 md:p-8 space-y-8 shadow-[var(--shadow-soft)]">
                {/* Dossier Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-foreground/10 pb-5">
                  <div>
                    <span className="text-[10px] font-medium uppercase tracking-widest text-clay">
                      Active Victim Dossier
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-baseline gap-2.5 flex-wrap">
                        <h2 className="font-mono text-3xl font-bold text-foreground">
                          {selectedCase.codeword}
                        </h2>
                        {selectedCase.victim_profile?.name && (
                          <span className="text-xl font-display font-bold text-forest dark:text-emerald-400">
                            — {selectedCase.victim_profile.name}
                          </span>
                        )}
                      </div>
                      {selectedCase.share_personal_info ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Personal Info Disclosed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/10 border border-foreground/15 px-3 py-1 text-xs font-semibold text-foreground/70">
                          <Lock className="h-3 w-3 text-foreground/60" />
                          <span>Strict Anonymous Shield</span>
                        </span>
                      )}

                      {/* Active Modality Badge */}
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold font-mono ${
                        selectedCase.latest_modality === "camera used"
                          ? "bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300"
                          : selectedCase.latest_modality === "voice used"
                          ? "bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300"
                          : "bg-forest/15 border border-forest/30 text-forest"
                      }`}>
                        {selectedCase.latest_modality === "camera used" ? (
                          <>
                            <Camera className="h-3 w-3" />
                            <span>Camera Used · OpenCV {Math.round((selectedCase.ml_scores?.camera_distress_score ?? selectedCase.latest_checkin?.camera_distress_score ?? 0.35) * 100)}% ({selectedCase.ml_scores?.primary_emotion || selectedCase.latest_checkin?.primary_emotion || "Neutral"})</span>
                          </>
                        ) : selectedCase.latest_modality === "voice used" ? (
                          <>
                            <Mic className="h-3 w-3" />
                            <span>Voice Used · Acoustic {Math.round((selectedCase.ml_scores?.voice_stress_score ?? 0.28) * 100)}%</span>
                          </>
                        ) : (
                          <>
                            <FileText className="h-3 w-3" />
                            <span>Text Used · MuRIL {Math.round((selectedCase.ml_scores?.sentiment_score ?? 0.45) * 100)}%</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="text-xs text-foreground/50 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>Case ID: {selectedCase.case_id}</span>
                      <span>·</span>
                      <span>Began: {selectedCase.created_at}</span>
                      <span>·</span>
                      <span className="font-mono text-clay font-bold flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        Keypad Code: {selectedCase.keypad_code || "*7#"}
                      </span>
                      {selectedCase.share_personal_info && selectedCase.victim_profile && (
                        <>
                          <span>·</span>
                          <span className="text-foreground/80 font-medium flex items-center gap-2">
                            <span>Victim: {selectedCase.victim_profile.name || "Identified"}</span>
                            {selectedCase.victim_profile.phone && (
                              <span className="text-forest font-mono flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {selectedCase.victim_profile.phone}
                              </span>
                            )}
                            {(selectedCase.close_phone || selectedCase.victim_profile.close_phone) && (
                              <span className="text-clay font-mono flex items-center gap-1">
                                <Heart className="h-3 w-3" /> Close: {selectedCase.close_phone || selectedCase.victim_profile.close_phone}
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status Ribbon Selector */}
                  <div className="flex flex-wrap gap-1.5 self-start sm:self-auto bg-foreground/5 p-1 rounded-full border border-foreground/10">
                    {(["new", "contacted", "in_support", "resolved"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleStatusChange(st)}
                        className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                          selectedCase.status === st
                            ? "bg-forest text-forest-foreground shadow-sm font-semibold"
                            : "text-foreground/60 hover:text-foreground"
                        }`}
                      >
                        {st === "in_support" ? "In Support" : st.charAt(0).toUpperCase() + st.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Real-time AI Threat & Crisis Escalation Warning on Selected Case */}
                {(selectedCase.triage_priority?.startsWith("P1") ||
                  selectedCase.ml_scores?.threat_flag ||
                  selectedCase.ml_scores?.trend_flag === "ESCALATING") && (
                  <div className="rounded-2xl border-2 border-red-500/40 bg-red-500/10 p-5 space-y-3 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                          ⚠️ Live AI Threat & Crisis Escalation Warning
                        </span>
                      </div>
                      <Link
                        to="/counsellor/trace/$threadId"
                        params={{ threadId: selectedCase.case_id || "thread-8492" }}
                        className="text-[11px] font-semibold text-red-700 dark:text-red-400 hover:underline flex items-center gap-1"
                      >
                        <span>Audit Explainable Trace →</span>
                      </Link>
                    </div>
                    <p className="text-xs text-foreground/85 leading-relaxed">
                      Bayesian linear-Gaussian model detected an escalation state. Recent victim interaction:{" "}
                      <strong className="text-foreground">
                        {selectedCase.share_personal_info === false
                          ? "[Confidential chat text shielded by victim privacy choice]"
                          : `"${selectedCase.summary}"`}
                      </strong>.
                      Sensor weighting:{" "}
                      <span className="font-mono text-clay font-bold">Threat: 59%, Distress: 26%, Voice: 15%</span>.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleStatusChange("in_support")}
                        className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition-colors shadow-sm"
                      >
                        Initiate Urgent Contact
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange("contacted")}
                        className="rounded-full border border-foreground/20 bg-background/60 px-4 py-1.5 text-xs font-medium text-foreground hover:bg-background transition-colors"
                      >
                        Mark Contacted
                      </button>
                    </div>
                  </div>
                )}

                {/* PRIMARY SHOWPIECE: Unified Victim Data Stream (Questionnaire + Live Chat) */}
                <div className="rounded-2xl border border-clay/30 bg-card/90 p-5 space-y-4 shadow-[var(--shadow-soft)] ring-1 ring-clay/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-foreground/10 pb-3">
                    <div className="flex items-center gap-2">
                      <HeartHandshake className="h-4 w-4 text-clay" />
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <span>Live Incoming Victim Data Stream</span>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-foreground/50 bg-foreground/5 px-2.5 py-0.5 rounded-full">
                      Real-Time Ingestion · PWA Encrypted
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Left: Latest Questionnaire Check-in */}
                    <div className="rounded-xl border border-foreground/10 bg-background/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-sage-deep flex items-center gap-1.5">
                          <span>Intake Assessment</span>
                          <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${
                            selectedCase.latest_checkin?.modality === "camera used"
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                              : selectedCase.latest_checkin?.modality === "voice used"
                              ? "bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                              : "bg-forest/20 text-forest border border-forest/20"
                          }`}>
                            {selectedCase.latest_checkin?.modality === "camera used" ? (
                              <>
                                <Camera className="h-2.5 w-2.5" />
                                <span>Camera Used</span>
                              </>
                            ) : selectedCase.latest_checkin?.modality === "voice used" ? (
                              <>
                                <Mic className="h-2.5 w-2.5" />
                                <span>Voice Used</span>
                              </>
                            ) : (
                              <>
                                <FileText className="h-2.5 w-2.5" />
                                <span>Text Used</span>
                              </>
                            )}
                          </span>
                        </span>
                        <span className="text-[10px] font-mono text-foreground/40">
                          {selectedCase.latest_checkin ? selectedCase.latest_checkin.date : selectedCase.created_at}
                        </span>
                      </div>

                      {selectedCase.latest_checkin ? (
                        <div className="space-y-2 text-xs">
                          {/* Modality Specific Assessment Row */}
                          {selectedCase.latest_checkin.modality === "camera used" ? (
                            <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                                  <Camera className="h-3 w-3" />
                                  <span>OpenCV FER+ Emotion (Session Average)</span>
                                </span>
                                <span className="font-mono font-bold text-amber-600">
                                  {Math.round((selectedCase.latest_checkin.camera_distress_score ?? selectedCase.ml_scores?.camera_distress_score ?? 0.35) * 100)}% Distress
                                </span>
                              </div>
                              <p className="text-[10px] text-foreground/60 italic">
                                Primary Emotion: <strong className="text-foreground capitalize">{selectedCase.latest_checkin.primary_emotion?.toLowerCase() || "neutral"}</strong> · Session arithmetic mean across OpenCV ONNX video frames
                              </p>
                            </div>
                          ) : selectedCase.latest_checkin.modality === "voice used" ? (
                            <div className="p-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5 space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                                  <Mic className="h-3 w-3" />
                                  <span>Voice Model Perception (Sohon :8100)</span>
                                </span>
                                <span className="font-mono font-bold text-clay">
                                  {Math.round((selectedCase.latest_checkin.voice_stress_score ?? 0.28) * 100)}% Stress
                                </span>
                              </div>
                              <p className="text-[10px] text-foreground/60 italic">
                                {selectedCase.latest_checkin.voice_label || "Acoustic strain & prosody analyzed"}
                              </p>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-lg border border-forest/20 bg-forest/5 space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-forest flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  <span>MuRIL Distress & Threat Perception</span>
                                </span>
                                <span className="font-mono font-bold text-forest">
                                  {Math.round((selectedCase.ml_scores?.sentiment_score ?? 0.45) * 100)}% Distress
                                </span>
                              </div>
                              <p className="text-[10px] text-foreground/60 italic">
                                {selectedCase.latest_checkin.sentiment_label || "Text intake processed via MuRIL language model"}
                              </p>
                            </div>
                          )}

                          <div className="flex items-center justify-between bg-card p-2.5 rounded-lg border border-foreground/5">
                            <span className="text-foreground/60">State of Mind:</span>
                            <span className="font-display text-sm font-bold text-clay flex items-center gap-1">
                              {selectedCase.latest_checkin.mood === 1 ? "🌧️ Fragile (1/5)" :
                               selectedCase.latest_checkin.mood === 2 ? "☁️ Heavy (2/5)" :
                               selectedCase.latest_checkin.mood === 3 ? "🍃 Steady (3/5)" :
                               selectedCase.latest_checkin.mood === 4 ? "🌱 Grounded (4/5)" : "☀️ Light (5/5)"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between bg-card p-2.5 rounded-lg border border-foreground/5">
                            <span className="text-foreground/60">Rest & Sleep:</span>
                            <span className="font-mono text-xs font-semibold text-foreground">
                              {selectedCase.latest_checkin.sleepHours} hrs ({selectedCase.latest_checkin.sleepQuality})
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-foreground/50 block mb-1">Emotion Chips Tagged:</span>
                            <div className="flex flex-wrap gap-1">
                              {(selectedCase.latest_checkin.feelings || []).map((f) => (
                                <span key={f} className="rounded-full bg-clay/10 text-clay text-[10px] px-2 py-0.5 font-medium">
                                  {f}
                                </span>
                              ))}
                            </div>
                          </div>

                          {selectedCase.latest_checkin.reflection && (
                            <div className="bg-background/80 p-2.5 rounded-lg border border-foreground/5 italic text-[11px] text-foreground/80">
                              "{selectedCase.latest_checkin.reflection}"
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-foreground/50 py-3 space-y-2">
                          <p className="leading-relaxed">
                            Victim check-in questionnaire answers will stream here live as soon as submitted from <code className="font-mono text-[10px] bg-foreground/5 px-1 py-0.5 rounded">/checkin</code>.
                          </p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {(selectedCase.signals || []).map((s) => (
                              <span key={s} className="rounded-full bg-sage/20 text-forest-deep text-[10px] px-2 py-0.5">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: Sanctuary Chat Summary & Live Signals */}
                    <div className="rounded-xl border border-foreground/10 bg-background/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-forest flex items-center gap-1.5">
                          <span>Sanctuary Chat Stream</span>
                        </span>
                        <span className="text-[10px] font-mono text-foreground/40">
                          {selectedCase.last_interaction}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        {selectedCase.share_personal_info === false ? (
                          <div className="bg-card p-4 rounded-xl border border-foreground/10 space-y-2 text-center py-6">
                            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 text-foreground/50">
                              <EyeOff className="h-4 w-4" />
                            </div>
                            <span className="font-semibold text-xs text-foreground block">
                              Confidential Sanctuary Dialogue Shielded
                            </span>
                            <p className="text-[11px] text-foreground/60 leading-relaxed max-w-xs mx-auto">
                              The victim has opted for complete anonymity and chat confidentiality. Direct message texts are not displayed to the counsellor.
                            </p>
                          </div>
                        ) : (
                          <div className="bg-card p-2.5 rounded-lg border border-foreground/5 space-y-1">
                            <span className="text-[10px] text-foreground/50 block font-medium">Latest Text from Victim:</span>
                            <p className="text-foreground/90 italic font-mono bg-background/60 p-2.5 rounded-lg border border-foreground/5 leading-relaxed">
                              "{selectedCase.summary?.trim() && selectedCase.summary !== "No chat dialogue recorded yet." ? selectedCase.summary : "not taken chat"}"
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                          <div className="bg-card p-2 rounded-lg border border-foreground/5">
                            <span className="text-[9px] text-foreground/45 block uppercase">Distress (MuRIL)</span>
                            <span className="font-bold text-foreground">
                              {((selectedCase.ml_scores?.sentiment_score || 0.45) * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="bg-card p-2 rounded-lg border border-foreground/5">
                            <span className="text-[9px] text-foreground/45 block uppercase">Threat Flag</span>
                            <span className={`font-bold ${selectedCase.ml_scores?.threat_flag ? "text-red-600" : "text-emerald-600"}`}>
                              {selectedCase.ml_scores?.threat_flag ? "FLAGGED" : "CLEAR"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-foreground/50 pt-1">
                          <span>Channel: PWA End-to-End Encrypted</span>
                          {selectedCase.share_personal_info !== false && (
                            <Link to="/chat" className="text-clay hover:underline font-semibold">
                              Open Chat View →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SHOWPIECE: Persistent Multi-Turn Victim Interaction History (Stored Timeline for Assigned Case) */}
                <div className="rounded-2xl border border-forest/25 bg-forest/5 p-5 space-y-4 shadow-[var(--shadow-soft)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-foreground/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-forest/15 text-forest">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">
                          Victim Interaction History (Full Timeline for Assigned Case)
                        </h3>
                        <p className="text-[11px] text-foreground/60">
                          Complete sanctuary chat dialogue between victim and Sahayak AI Bot.
                        </p>
                      </div>
                    </div>
                    {selectedCase.share_personal_info !== false && (
                      <span className="text-[10px] font-mono text-forest bg-forest/10 px-2.5 py-0.5 rounded-full font-semibold">
                        Dialogue Stream Active
                      </span>
                    )}
                  </div>

                  {/* Anonymous Shield Notice OR Full Dialogue Timeline */}
                  {selectedCase.share_personal_info === false ? (
                    <div className="rounded-xl border border-foreground/15 bg-background/80 p-5 text-center space-y-2">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground/70">
                        <EyeOff className="h-5 w-5" />
                      </div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
                        Victim Chosen Confidential Mode
                      </h4>
                      <p className="text-xs text-foreground/60 max-w-md mx-auto leading-relaxed">
                        The victim has chosen to remain anonymous. Sanctuary dialogue with Sahayak Bot is shielded under clinical confidentiality and is not visible to the counsellor.
                      </p>
                    </div>
                  ) : fullChatTurns.length === 0 ? (
                    <div className="text-center py-6 text-xs text-foreground/45 border border-dashed border-foreground/15 rounded-xl">
                      No sanctuary chat messages recorded for this case yet. Messages between the victim and Sahayak AI Bot will stream here automatically.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-foreground/50 border-b border-foreground/10 pb-1">
                        <span>Sanctuary Dialogue Stream ({fullChatTurns.length} turns)</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">● Live Multi-Turn History</span>
                      </div>
                      <div className="space-y-2.5 bg-background/60 rounded-xl p-3 border border-foreground/10">
                        {fullChatTurns.map((turn, tIdx) => (
                          <div
                            key={tIdx}
                            className={`flex flex-col gap-1 p-3 rounded-xl text-xs transition-all ${
                              turn.role === "user"
                                ? "bg-forest/10 border border-forest/25 mr-6 shadow-sm"
                                : turn.role === "assistant"
                                ? "bg-card border border-foreground/15 ml-6 shadow-sm"
                                : "bg-amber-500/10 border border-amber-500/20 text-foreground/80 mx-4"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono text-foreground/55 border-b border-foreground/5 pb-1">
                              <span className="font-semibold uppercase tracking-wider">
                                {turn.role === "user"
                                  ? `Victim (${selectedCase.victim_profile?.name || selectedCase.codeword})`
                                  : turn.role === "assistant"
                                  ? "Sahayak AI Bot"
                                  : "System Note"}
                              </span>
                            </div>
                            <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed text-[11px] pt-0.5">
                              {typeof turn.content === "string" ? turn.content : JSON.stringify(turn.content)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* SHOWPIECE: Timeline Distress Overlay */}
                <div className="rounded-2xl border border-foreground/10 bg-background/50 p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                      Distress Trajectory & Clinical Milestones
                    </span>
                    <span className="text-[11px] text-foreground/45">Multi-signal fusion index</span>
                  </div>
                  <TimelineOverlay data={selectedCase.distress_trajectory || []} />
                </div>

                {/* ML Perception Scores Panel */}
                {selectedCase.ml_scores && (
                  <div className="rounded-2xl border border-foreground/10 bg-background/50 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-clay" />
                        AI Perception Signals · Live Model Output
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        selectedCase.ml_scores.trend_flag === "ESCALATING"
                          ? "bg-red-500/15 text-red-600"
                          : "bg-sage/30 text-forest-deep"
                      }`}>
                        {selectedCase.ml_scores.trend_flag}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {/* Sentiment / Distress */}
                      <div className="rounded-xl bg-card border border-foreground/10 p-3 space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Distress</span>
                        <div className={`text-lg font-bold font-mono ${
                          selectedCase.ml_scores.sentiment_label === "HIGH" ? "text-red-500"
                          : selectedCase.ml_scores.sentiment_label === "MODERATE" ? "text-clay"
                          : "text-forest"
                        }`}>
                          {selectedCase.ml_scores.sentiment_label}
                        </div>
                        <div className="w-full bg-foreground/10 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${selectedCase.ml_scores.sentiment_label === "HIGH" ? "bg-red-500" : selectedCase.ml_scores.sentiment_label === "MODERATE" ? "bg-clay" : "bg-forest"}`}
                            style={{ width: `${selectedCase.ml_scores.sentiment_score * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-foreground/40 font-mono">{(selectedCase.ml_scores.sentiment_score * 100).toFixed(0)}%</span>
                      </div>

                      {/* Threat */}
                      <div className="rounded-xl bg-card border border-foreground/10 p-3 space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Threat</span>
                        <div className={`text-lg font-bold font-mono ${selectedCase.ml_scores.threat_flag ? "text-red-600" : "text-forest"}`}>
                          {selectedCase.ml_scores.threat_flag ? "⚠ FLAGGED" : "CLEAR"}
                        </div>
                        <div className="w-full bg-foreground/10 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${selectedCase.ml_scores.threat_flag ? "bg-red-500" : "bg-forest"}`}
                            style={{ width: `${selectedCase.ml_scores.threat_prob * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-foreground/40 font-mono">P={( selectedCase.ml_scores.threat_prob * 100).toFixed(0)}%</span>
                      </div>

                      {/* Voice Stress */}
                      <div className="rounded-xl bg-card border border-foreground/10 p-3 space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Voice</span>
                        {selectedCase.ml_scores.has_voice_recording ? (
                          <>
                            <div className={`text-lg font-bold font-mono ${selectedCase.ml_scores.voice_label === "STRESSED" ? "text-clay" : "text-forest"}`}>
                              {selectedCase.ml_scores.voice_label === "STRESSED" ? "STRESSED" : "CALM"}
                            </div>
                            <div className="w-full bg-foreground/10 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-clay"
                                style={{ width: `${(selectedCase.ml_scores.voice_stress_score ?? 0) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-foreground/40 font-mono">{((selectedCase.ml_scores.voice_stress_score ?? 0) * 100).toFixed(0)}%</span>
                          </>
                        ) : (
                          <div className="pt-1 space-y-1">
                            <div className="text-sm font-semibold font-mono text-foreground/45 uppercase tracking-wide">
                              not recorded
                            </div>
                            <p className="text-[10px] text-foreground/40 leading-snug">
                              Awaiting victim voice audio note or audio sample
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Composite score bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] text-foreground/50">
                        <span>Composite Risk Score</span>
                        <span className="font-mono font-semibold text-foreground/70">{(selectedCase.ml_scores.composite_score * 100).toFixed(0)} / 100 · conf {(selectedCase.ml_scores.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-foreground/10 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            selectedCase.ml_scores.composite_score >= 0.75 ? "bg-red-500"
                            : selectedCase.ml_scores.composite_score >= 0.5 ? "bg-clay"
                            : "bg-forest"
                          }`}
                          style={{ width: `${selectedCase.ml_scores.composite_score * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Signals Tags */}
                <div>
                  <span className="text-xs text-foreground/50 uppercase tracking-wider block mb-2 font-medium">
                    Telemetry & Consent Indicators
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(selectedCase.signals || []).map((sig) => (
                      <span
                        key={sig}
                        className="rounded-full bg-sage/25 px-3 py-1 text-xs font-medium text-forest-deep"
                      >
                        ✓ {sig}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Field Notebook (Notes Editor) */}
                <div className="space-y-4 pt-2 border-t border-foreground/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-clay flex items-center gap-1.5">
                      <FileText className="h-4 w-4" /> Clinician Field Notebook
                    </span>
                    <span className="text-[10px] text-foreground/40 font-mono">
                      Timestamped Audit
                    </span>
                  </div>

                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={3}
                      placeholder="Record clinical observation, grounding anchor applied, or callback notes..."
                      className="w-full rounded-2xl border border-foreground/15 bg-background/80 p-3.5 text-xs text-foreground placeholder:text-foreground/35 focus:border-clay focus:outline-none"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={!newNote.trim()}
                        className="inline-flex items-center gap-2 rounded-full bg-clay px-5 py-2 text-xs font-medium text-white hover:bg-forest transition-colors disabled:opacity-40"
                      >
                        <Send className="h-3 w-3" />
                        <span>Log Note</span>
                      </button>
                    </div>
                  </form>

                  {/* Clinician Notes List */}
                  {(() => {
                    const clinicianNotes = (selectedCase.fieldNotes || []).filter(
                      (note) => !note.author.toLowerCase().includes("victim") && !note.author.includes("CRITICAL")
                    );
                    return clinicianNotes.length > 0 ? (
                      <div className="space-y-3 pt-2">
                        {clinicianNotes.map((note) => (
                          <div
                            key={note.id}
                            className="rounded-2xl border border-foreground/10 bg-background/40 p-4 space-y-1.5 text-xs"
                          >
                            <div className="flex items-center justify-between text-[11px] text-foreground/50 border-b border-foreground/5 pb-1">
                              <strong className="text-foreground/80 font-medium">
                                {note.author}
                              </strong>
                              <span className="font-mono">{note.timestamp}</span>
                            </div>
                            <p className="text-foreground/85 leading-relaxed pt-1 font-mono text-[11px]">
                              {note.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-foreground/15 p-6 text-center text-xs text-foreground/45">
                        No clinician notes logged yet for this dossier. Enter clinical observations above to record.
                      </div>
                    );
                  })()}
                </div>

                {/* DEMO SANDBOX: Live AI Model Scoring Studio (Port :8100 & :8200) */}
                <div className="rounded-2xl border-2 border-clay/30 bg-card/70 p-5 space-y-4 shadow-[var(--shadow-soft)] opacity-95 mt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-foreground/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-clay/10 text-clay">
                        <Cpu className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <span>Demo Sandbox: Live AI Model Scoring Studio</span>
                          <span className="text-[10px] bg-forest/20 text-forest-deep px-2 py-0.5 rounded-full font-mono">
                            Jury / Evaluator Testbed
                          </span>
                        </h3>
                        <p className="text-[11px] text-foreground/50">
                          Direct live inference via port :8100 · MuRIL Distress (v3) + Threat-v7 + Bayesian Fusion (:8200)
                        </p>
                      </div>
                    </div>
                    {liveResult && (
                      <span className="text-[10px] font-mono uppercase tracking-wider bg-foreground/5 px-2.5 py-1 rounded-full text-foreground/70 self-start sm:self-auto">
                        ⚡ {liveResult.latency_ms}ms · {liveResult.source === "live_huggingface_service" ? "HF Microservice" : "Calibrated"}
                      </span>
                    )}
                  </div>

                  {/* Quick Preset Prompts */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/45">Quick evaluation presets:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "🚨 Critical Danger & Stalking", text: "I cannot take this anymore, they are following me" },
                        { label: "🟡 Severe Isolation & Despair", text: "Nobody understands how alone I feel, I haven't left bed in days" },
                        { label: "🟢 Grounded & Stable Recovery", text: "Took my morning walk by the river and feel quiet and steady today" },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setScoringInput(preset.text)}
                          className="rounded-full border border-foreground/15 bg-background/50 px-3 py-1 text-[11px] text-foreground/70 hover:border-clay hover:text-clay transition-all text-left"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input and Action */}
                  <div className="space-y-2">
                    <textarea
                      value={scoringInput}
                      onChange={(e) => setScoringInput(e.target.value)}
                      rows={2}
                      placeholder="Type or paste any victim narrative, message, or transcript to score live..."
                      className="w-full rounded-xl border border-foreground/15 bg-background p-3 text-xs text-foreground placeholder:text-foreground/35 focus:border-clay focus:outline-none"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] text-foreground/40 font-mono">
                        Models: distress-v3 (950MB MuRIL) · threat-v7 · risk-fusion-v1
                      </span>
                      <button
                        type="button"
                        onClick={handleRunLiveScoring}
                        disabled={isScoring || !scoringInput.trim()}
                        className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2 text-xs font-semibold text-forest-foreground hover:bg-clay transition-colors disabled:opacity-40 shadow-sm"
                      >
                        {isScoring ? (
                          <>
                            <Sparkles className="h-3.5 w-3.5 animate-spin text-clay-soft" />
                            <span>Running Model Inference...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="h-3.5 w-3.5 text-clay-soft" />
                            <span>Run Hugging Face Inference</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Live Results Card */}
                  {liveResult && (
                    <div className="rounded-xl border border-clay/30 bg-background/80 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                          <Radio className="h-3.5 w-3.5 text-clay animate-pulse" /> Live Inference Breakdown
                        </span>
                        <button
                          type="button"
                          onClick={handleLogScoreAsNote}
                          className="text-[11px] text-clay hover:underline font-semibold flex items-center gap-1"
                        >
                          <span>+ Save to Case Notes</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* Sentiment Box */}
                        <div className="rounded-lg bg-card p-3 border border-foreground/10 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/50">Distress Level (MuRIL)</span>
                            <span className="text-[10px] font-mono text-foreground/40">{liveResult.sentiment.model_version}</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className={`text-xl font-bold font-mono ${
                              liveResult.sentiment.label === "HIGH" ? "text-red-500"
                              : liveResult.sentiment.label === "MODERATE" ? "text-clay"
                              : "text-forest"
                            }`}>
                              {liveResult.sentiment.label}
                            </span>
                            <span className="text-xs font-mono text-foreground/60">
                              {(liveResult.sentiment.sentiment_score * 100).toFixed(1)}% distress
                            </span>
                          </div>
                          <div className="flex gap-2 pt-1 text-[10px] font-mono text-foreground/50">
                            <span>L: {((liveResult.sentiment.probs?.LOW || 0) * 100).toFixed(0)}%</span>
                            <span>M: {((liveResult.sentiment.probs?.MODERATE || 0) * 100).toFixed(0)}%</span>
                            <span>H: {((liveResult.sentiment.probs?.HIGH || 0) * 100).toFixed(0)}%</span>
                            <span className="ml-auto">Conf: {(liveResult.sentiment.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>

                        {/* Threat Box */}
                        <div className="rounded-lg bg-card p-3 border border-foreground/10 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/50">Threat Classifier</span>
                            <span className="text-[10px] font-mono text-foreground/40">{liveResult.threat.model_version}</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className={`text-xl font-bold font-mono ${liveResult.threat.threat_flag ? "text-red-600" : "text-emerald-600"}`}>
                              {liveResult.threat.threat_flag ? "🚨 THREAT DETECTED" : "🛡️ CLEAR (SAFE)"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-foreground/50">
                            <span>Threat Probability: {((liveResult.threat.prob || 0) * 100).toFixed(1)}%</span>
                            <span>Conf: {(liveResult.threat.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>

                        {/* Bayesian Fusion Engine Box */}
                        {liveResult.fusion && (
                          <div className="sm:col-span-2 rounded-lg bg-card p-3 border border-clay/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/50 flex items-center gap-1">
                                <Cpu className="h-3 w-3 text-clay" />
                                Bayesian Linear-Gaussian Fusion Engine (Port :8200)
                              </span>
                              <span className="text-[10px] font-mono font-bold text-clay uppercase">
                                {liveResult.fusion.label}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="bg-background/60 p-2 rounded-lg border border-foreground/5">
                                <span className="text-[10px] text-foreground/50 block">Composite Risk</span>
                                <span className="font-mono font-bold text-foreground">
                                  {(liveResult.fusion.composite_score * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="bg-background/60 p-2 rounded-lg border border-foreground/5">
                                <span className="text-[10px] text-foreground/50 block">Confidence</span>
                                <span className="font-mono font-bold text-forest">
                                  {(liveResult.fusion.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="bg-background/60 p-2 rounded-lg border border-foreground/5">
                                <span className="text-[10px] text-foreground/50 block">Triggers</span>
                                <span className="font-mono font-bold text-red-600">
                                  {liveResult.fusion.triggers.length > 0 ? liveResult.fusion.triggers.join(", ") : "nominal"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-mono text-foreground/50 pt-1">
                              <span>Weights: Threat 59% · Sentiment 26% · Voice 15%</span>
                              <span>Signals: {liveResult.fusion.top_signals.join(" > ")}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-foreground/20 p-16 text-center text-foreground/40">
                Select a case record to inspect field notes
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
