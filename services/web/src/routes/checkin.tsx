import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { saveCheckIn, recordVictimQuestionnaire } from "@/lib/store";
import { ArrowLeft, ArrowRight, Check, Heart, Moon, Wind, Sparkles } from "lucide-react";

export const Route = createFileRoute("/checkin")({
  head: () => ({
    meta: [{ title: "Daily Check-in — Sahayak" }],
  }),
  component: CheckInPage,
});

const MOODS = [
  { val: 1 as const, label: "Fragile", desc: "Tender, needing soft ground", color: "bg-clay/20 border-clay text-clay" },
  { val: 2 as const, label: "Heavy", desc: "Carrying a lot right now", color: "bg-clay/10 border-clay/60 text-clay" },
  { val: 3 as const, label: "Steady", desc: "Even, floating along", color: "bg-sage/30 border-sage text-sage-deep" },
  { val: 4 as const, label: "Grounded", desc: "Rooted, finding balance", color: "bg-forest/15 border-forest text-forest" },
  { val: 5 as const, label: "Light", desc: "Gentle ease in the chest", color: "bg-sage/40 border-forest text-forest-deep" },
];

const FEELING_CHIPS = [
  "Heavy",
  "Numb",
  "Racing",
  "Tight chest",
  "Quiet",
  "Fragile",
  "Still",
  "Grounded",
  "Foggy",
  "Exhausted",
  "Tender",
  "Cautious",
  "Hopeful",
  "Grateful",
];

const SLEEP_QUALITIES = ["Restless", "Broken", "Adequate", "Restful", "Deep"];

export default function CheckInPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [sleepHours, setSleepHours] = useState(6.5);
  const [sleepQuality, setSleepQuality] = useState("Adequate");
  const [feelings, setFeelings] = useState<string[]>(["Steady"]);
  const [reflection, setReflection] = useState("");
  const [breathPhase, setBreathPhase] = useState<"Inhale" | "Hold" | "Exhale">("Inhale");

  const toggleFeeling = (f: string) => {
    if (feelings.includes(f)) {
      setFeelings(feelings.filter((x) => x !== f));
    } else {
      setFeelings([...feelings, f]);
    }
  };

  const handleFinish = () => {
    const selectedMoodObj = MOODS.find((m) => m.val === mood);
    const entry = saveCheckIn({
      date: new Date().toISOString().split("T")[0],
      mood,
      moodLabel: selectedMoodObj?.label || "Steady",
      sleepHours,
      sleepQuality,
      feelings,
      reflection: reflection.trim() || undefined,
    });
    // Immediately sync questionnaire to Counsellor Case Dossier & Admin Observatory!
    recordVictimQuestionnaire(entry);
    setStep(5); // Move to closing breathing circle
  };

  return (
    <div className="grain min-h-screen bg-background text-foreground flex flex-col justify-between p-6 md:p-12 relative overflow-hidden">
      {/* Top Header */}
      <div className="mx-auto w-full max-w-xl flex items-center justify-between z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-foreground/60 hover:text-clay transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Sanctuary Home</span>
        </Link>
        <span className="font-display text-lg text-foreground/70">Sahayak Check-in</span>
        <span className="text-xs text-foreground/40 font-mono tracking-widest">
          {step <= 4 ? `0${step} / 04` : "Breathe"}
        </span>
      </div>

      {/* Progress line */}
      {step <= 4 && (
        <div className="mx-auto w-full max-w-xl my-4">
          <div className="h-1 w-full bg-foreground/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-clay transition-all duration-700 ease-out"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="mx-auto w-full max-w-xl my-auto py-8 z-10">
        {/* Step 1: Mood */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-medium uppercase tracking-[0.25em] text-sage-deep">
                Question 01
              </span>
              <h2 className="text-4xl md:text-5xl font-display leading-tight">
                How does the room inside you feel right now?
              </h2>
              <p className="text-sm text-foreground/60">
                Notice without judging. There are no right answers here.
              </p>
            </div>

            {/* Hand-drawn mood arc selector */}
            <div className="grid gap-3 pt-2">
              {MOODS.map((m) => {
                const isSelected = mood === m.val;
                return (
                  <button
                    key={m.val}
                    type="button"
                    onClick={() => setMood(m.val)}
                    className={`flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-300 ${
                      isSelected
                        ? "border-clay bg-card shadow-[var(--shadow-lift)] scale-[1.02]"
                        : "border-foreground/10 bg-card/40 hover:bg-card/70 hover:border-foreground/20"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <span
                        className={`h-4 w-4 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected ? "border-clay bg-clay" : "border-foreground/30"
                        }`}
                      >
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <div>
                        <div className="font-display text-xl text-foreground">{m.label}</div>
                        <div className="text-xs text-foreground/60">{m.desc}</div>
                      </div>
                    </div>
                    <span className="text-lg opacity-80">
                      {m.val === 1 ? "🌧️" : m.val === 2 ? "☁️" : m.val === 3 ? "🍃" : m.val === 4 ? "🌱" : "☀️"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-full bg-forest px-7 py-3 text-sm font-medium text-forest-foreground transition-all hover:bg-clay"
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Sleep */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-medium uppercase tracking-[0.25em] text-sage-deep">
                Question 02
              </span>
              <h2 className="text-4xl md:text-5xl font-display leading-tight">
                How did sleep hold you last night?
              </h2>
              <p className="text-sm text-foreground/60">
                Rest shapes how the day feels on your skin.
              </p>
            </div>

            <div className="space-y-6 pt-2">
              {/* Quality chips */}
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-foreground/50">
                  Restfulness
                </label>
                <div className="flex flex-wrap gap-2">
                  {SLEEP_QUALITIES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setSleepQuality(q)}
                      className={`px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                        sleepQuality === q
                          ? "bg-forest text-forest-foreground border-forest"
                          : "bg-card/50 border-foreground/15 text-foreground/75 hover:bg-card"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hours slider */}
              <div className="space-y-3 rounded-2xl border border-foreground/10 bg-card/60 p-5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-foreground/70 flex items-center gap-2">
                    <Moon className="h-4 w-4 text-clay" /> Approximate Hours
                  </span>
                  <span className="font-display text-2xl text-foreground font-semibold">
                    {sleepHours} hrs
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="0.5"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                  className="w-full accent-clay cursor-pointer h-2 bg-foreground/10 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-foreground/40 uppercase tracking-widest font-mono">
                  <span>Little to none</span>
                  <span>Restful slumber</span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-foreground/60 hover:text-clay transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 rounded-full bg-forest px-7 py-3 text-sm font-medium text-forest-foreground transition-all hover:bg-clay"
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Feelings */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-medium uppercase tracking-[0.25em] text-sage-deep">
                Question 03
              </span>
              <h2 className="text-4xl md:text-5xl font-display leading-tight">
                What words touch the edges of your day?
              </h2>
              <p className="text-sm text-foreground/60">
                Choose any that resonate. Contradictions are welcome.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              {FEELING_CHIPS.map((chip) => {
                const active = feelings.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => toggleFeeling(chip)}
                    className={`px-4 py-2.5 rounded-full text-xs font-medium transition-all ${
                      active
                        ? "bg-clay text-white shadow-sm scale-105"
                        : "bg-card border border-foreground/10 text-foreground/75 hover:border-clay/40"
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>

            <div className="pt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-foreground/60 hover:text-clay transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 rounded-full bg-forest px-7 py-3 text-sm font-medium text-forest-foreground transition-all hover:bg-clay"
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Reflection */}
        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-medium uppercase tracking-[0.25em] text-sage-deep">
                Question 04
              </span>
              <h2 className="text-4xl md:text-5xl font-display leading-tight">
                Is there a thought you want to set down?
              </h2>
              <p className="text-sm text-foreground/60">
                Completely optional. Stays strictly inside this device.
              </p>
            </div>

            <div className="pt-2">
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="A sentence, a worry, or something gentle you noticed today..."
                className="w-full rounded-2xl border border-foreground/15 bg-card/80 p-4 text-sm text-foreground placeholder:text-foreground/35 focus:border-clay focus:outline-none focus:ring-1 focus:ring-clay"
              />
            </div>

            <div className="pt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-xs text-foreground/60 hover:text-clay transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                className="inline-flex items-center gap-2 rounded-full bg-clay px-8 py-3.5 text-sm font-medium text-white shadow-[var(--shadow-lift)] transition-all hover:bg-forest"
              >
                <span>Complete check-in</span>
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Full-Screen Breathing Circle */}
        {step === 5 && (
          <div className="animate-in zoom-in-95 fade-in duration-700 text-center py-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-medium uppercase tracking-[0.25em] text-clay">
                Grounding Moment
              </span>
              <h2 className="text-4xl md:text-5xl font-display">
                Thank you for showing up.
              </h2>
              <p className="text-sm text-foreground/70 max-w-md mx-auto">
                Your check-in has been quietly planted into your garden. Before you go, take 30
                seconds to steady your heartbeat.
              </p>
            </div>

            {/* Pulsing Breathing Circle */}
            <div className="relative py-12 flex items-center justify-center">
              {/* Outer halo */}
              <div className="animate-breathe absolute h-64 w-64 rounded-full bg-clay/10 blur-xl" />
              {/* Mid ring */}
              <div className="animate-orb h-52 w-52 rounded-full border border-clay/30 bg-card/80 backdrop-blur-md flex flex-col items-center justify-center shadow-[var(--shadow-soft)]">
                <Wind className="h-6 w-6 text-clay mb-2 opacity-80" />
                <span className="font-display text-2xl text-foreground">Breathe In</span>
                <span className="text-[11px] text-foreground/50 tracking-wider uppercase mt-1">
                  Hold · Release
                </span>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/history"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-forest px-8 py-3.5 text-sm font-medium text-forest-foreground shadow-[var(--shadow-lift)] transition-all hover:bg-clay"
              >
                <span>Visit Your Garden</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/chat"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-foreground/20 px-6 py-3.5 text-sm font-medium text-foreground hover:border-clay hover:text-clay transition-colors"
              >
                <span>Enter Quiet Chat</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer Quote */}
      <div className="mx-auto w-full max-w-xl text-center text-xs text-foreground/40 font-light z-10">
        Private & Anonymous · No numbers, no scores, no judgment
      </div>
    </div>
  );
}
