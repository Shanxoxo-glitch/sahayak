export interface CheckInEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mood: 1 | 2 | 3 | 4 | 5;
  moodLabel: string;
  sleepHours: number;
  sleepQuality: string;
  feelings: string[];
  reflection?: string;
  createdAt: number;
  modality?: "voice used" | "text used" | "camera used";
  voice_stress_score?: number;
  voice_label?: "STRESSED" | "NOT_STRESSED";
  camera_distress_score?: number;
  primary_emotion?: string;
  emotion_scores?: Record<string, number>;
  threat_prob?: number;
  threat_flag?: boolean;
  sentiment_score?: number;
  sentiment_label?: "LOW" | "MODERATE" | "HIGH";
  audio_url?: string;
}

export interface HelpRequest {
  id: string;
  codeword: string;
  supportType: "emotional" | "domestic" | "crisis" | "ongoing";
  supportTypeLabel: string;
  contactMethod: "in_app" | "callback" | "quiet_checkin";
  callbackWindow?: string;
  notes?: string;
  consentScopes: {
    chatAnalysis: boolean;
    voiceSignals: boolean;
    emailCheckin: boolean;
    smsCheckin: boolean;
    escalationLadder: boolean;
  };
  status: "new" | "contacted" | "in_support" | "resolved";
  createdAt: string;
  assignedCounsellor?: string;
}

export interface VictimHistoryItem {
  id: string;
  timestamp: string;
  text: string;
  source: "chat" | "questionnaire" | "intake" | "voice_checkin" | "camera_checkin";
  risk_level?: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  details?: string;
  modality?: "voice used" | "text used" | "camera used";
  camera_distress_score?: number;
  primary_emotion?: string;
}

export interface TriageAlert {
  alert_id: string;
  case_id: string;
  thread_id: string;
  risk_level: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  composite_score: number;
  confidence: number;
  triage_priority_score: number;
  raised_at: string;
  decision_status: "pending" | "approved" | "rejected";
  counsellor_note?: string;
  reasons: string[];
  channel: string;
  victim_text?: string;
  trigger_words?: string[];
  victim_info?: {
    codeword: string;
    share_personal_info: boolean;
    name?: string;
    email?: string;
    latest_mood?: string;
    latest_sleep?: string;
    history_count: number;
  };
  history?: VictimHistoryItem[];
}

export interface CaseNote {
  id: string;
  timestamp: string;
  author: string;
  text: string;
}

export interface CounsellorCase {
  id: string;
  case_id: string;
  codeword: string;
  triage_priority: "P1 - Immediate" | "P2 - Within 2h" | "P3 - Routine";
  status: "new" | "contacted" | "in_support" | "resolved";
  distress_trajectory: { date: string; score: number; event?: string }[];
  fieldNotes: CaseNote[];
  signals: string[];
  summary: string;
  last_interaction: string;
  created_at: string;
  latest_checkin?: CheckInEntry;
  latest_source?: "chat" | "questionnaire" | "intake" | "voice_checkin" | "camera_checkin";
  latest_modality?: "voice used" | "text used" | "camera used";
  share_personal_info?: boolean;
  keypad_code?: string;
  close_phone?: string;
  victim_profile?: {
    name?: string;
    email?: string;
    phone?: string;
    close_phone?: string;
    keypad_code?: string;
  };
  interaction_history?: VictimHistoryItem[];
  ml_scores?: {
    sentiment_label: "LOW" | "MODERATE" | "HIGH";
    sentiment_score: number;
    threat_flag: boolean;
    threat_prob: number;
    voice_stress_score?: number;
    voice_label?: "STRESSED" | "NOT_STRESSED";
    camera_distress_score?: number;
    primary_emotion?: string;
    has_voice_recording?: boolean;
    composite_score: number;
    confidence: number;
    trend_flag: "ESCALATING" | "STABLE";
  };
  is_seed?: boolean; // marks demo/placeholder data — excluded from victim registry
}

export interface DecisionTrace {
  thread_id: string;
  case_id: string;
  decision: {
    route: "crisis" | "escalate" | "routine";
    policy_version: string;
    reasons: string[];
  };
  fusion: {
    confidence: number;
    top_signals: string[];
  };
  errors: string[];
  victim_text?: string;
}

const STORAGE_KEYS = {
  CHECKINS: "sahayak_checkins",
  REQUESTS: "sahayak_requests",
  ALERTS: "sahayak_alerts",
  CASES: "sahayak_cases",
  ACTIVE_CODEWORD: "sahayak_active_codeword",
  ROLE: "sahayak_role",
  TRACES: "sahayak_traces",
};

export function notifyStoreChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("sahayak_store_updated"));
  window.dispatchEvent(new Event("storage"));
}

export function subscribeToStore(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("sahayak_store_updated", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("sahayak_store_updated", handler);
    window.removeEventListener("storage", handler);
  };
}

// Natural evocative codeword generator
const ADJECTIVES = ["quiet", "amber", "gentle", "misty", "calm", "river", "silver", "forest", "cedar", "warm"];
const NOUNS = ["river", "valley", "harbor", "willow", "meadow", "lantern", "pebble", "sparrow", "branch", "path"];

export function generateCodeword(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 89 + 10);
  return `${adj}-${noun}-${num}`;
}

// Check-ins
export function getCheckIns(): CheckInEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEYS.CHECKINS);
  if (!raw) return seedInitialCheckIns();
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCheckIn(entry: Omit<CheckInEntry, "id" | "createdAt">): CheckInEntry {
  const all = getCheckIns();
  const newEntry: CheckInEntry = {
    ...entry,
    id: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: Date.now(),
  };
  const updated = [newEntry, ...all];
  localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(updated));
  notifyStoreChange();
  return newEntry;
}

export function deleteCheckIn(id: string): void {
  const all = getCheckIns();
  const filtered = all.filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(filtered));
  notifyStoreChange();
}

// Help Requests
export function getHelpRequests(): HelpRequest[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEYS.REQUESTS);
  if (!raw) return seedInitialRequests();
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveHelpRequest(req: Omit<HelpRequest, "id" | "createdAt">): HelpRequest {
  const all = getHelpRequests();
  const newReq: HelpRequest = {
    ...req,
    id: `req_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [newReq, ...all];
  localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(updated));
  localStorage.setItem(STORAGE_KEYS.ACTIVE_CODEWORD, req.codeword);

  // Auto-sync into counsellor case files for seamless live demo!
  syncNewRequestToCases(newReq);
  notifyStoreChange();

  return newReq;
}

export function getActiveCodeword(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_CODEWORD);
}

export function setActiveCodeword(code: string): void {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_CODEWORD, code);
}

export interface VictimSharePreference {
  share: boolean;
  name?: string;
  email?: string;
  phone?: string;
}

export function getVictimSharePreference(): VictimSharePreference {
  if (typeof window === "undefined") return { share: false };
  try {
    const raw = localStorage.getItem("sahayak_victim_share_preference");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { share: false };
}

export function setVictimSharePreference(pref: VictimSharePreference): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("sahayak_victim_share_preference", JSON.stringify(pref));
  notifyStoreChange();
}

export interface AuthUser {
  user_id: string;
  email: string;
  name: string;
  role: "victim" | "counsellor" | "admin";
  phone?: string;
  close_phone?: string;
  keypad_code?: string;
  codeword?: string;
  share_personal_info?: boolean;
  auth_method?: "traditional" | "voice_keypad" | "opencv_camera";
}

export interface RegisteredVictimRecord {
  id: string;
  user_id: string;
  name?: string;
  email?: string;
  phone?: string;
  close_phone?: string;
  keypad_code?: string;
  codeword?: string;
  auth_method: "traditional" | "voice_keypad" | "opencv_camera";
  share_personal_info: boolean;
  registered_at: string;
  latest_modality?: "text used" | "voice used" | "camera used";
  voice_stress_score?: number;
  voice_label?: string;
  camera_distress_score?: number;
  primary_emotion?: string;
  risk_level?: string;
  case_id?: string;
}

export function getRegisteredVictims(): RegisteredVictimRecord[] {
  if (typeof window === "undefined") return [];
  const list: RegisteredVictimRecord[] = [];
  const seenIds = new Set<string>();

  // 1. Explicitly registered victims
  try {
    const raw = localStorage.getItem("sahayak_registered_victims");
    if (raw) {
      const parsed: RegisteredVictimRecord[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const v of parsed) {
          if (v && v.id && !seenIds.has(v.id)) {
            seenIds.add(v.id);
            list.push(v);
          }
        }
      }
    }
  } catch {}

  // 2. Also populate from active counsellor cases that contain victim profiles
  try {
    const rawCases = localStorage.getItem(STORAGE_KEYS.CASES);
    if (rawCases) {
      const cases: CounsellorCase[] = JSON.parse(rawCases);
      if (Array.isArray(cases)) {
        for (const c of cases) {
          // Skip demo/seed data — only real victim signups appear in registry
          if (c.is_seed) continue;
          const vId = c.victim_profile?.email || c.codeword || c.id;
          if (vId && !seenIds.has(vId) && c.victim_profile) {
            seenIds.add(vId);
            list.push({
              id: vId,
              user_id: c.id,
              name: c.victim_profile.name,
              email: c.victim_profile.email,
              phone: c.victim_profile.phone,
              close_phone: c.victim_profile.close_phone,
              keypad_code: c.victim_profile.keypad_code,
              codeword: c.codeword,
              auth_method:
                c.latest_modality === "camera used"
                  ? "opencv_camera"
                  : c.latest_modality === "voice used"
                  ? "voice_keypad"
                  : "traditional",
              share_personal_info: !!c.share_personal_info,
              registered_at: c.created_at || "Intake Record",
              latest_modality: c.latest_modality || "text used",
              voice_stress_score: c.ml_scores?.voice_stress_score,
              voice_label: c.ml_scores?.voice_label,
              camera_distress_score: c.interaction_history?.find((h) => h.camera_distress_score)?.camera_distress_score,
              primary_emotion: c.interaction_history?.find((h) => h.primary_emotion)?.primary_emotion,
              risk_level: c.triage_priority,
              case_id: c.case_id || c.id,
            });
          }
        }
      }
    }
  } catch {}

  return list;
}

export function saveRegisteredVictim(entry: Partial<RegisteredVictimRecord> & { user_id: string }): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("sahayak_registered_victims");
    let victims: RegisteredVictimRecord[] = [];
    if (raw) {
      try {
        victims = JSON.parse(raw) || [];
      } catch {
        victims = [];
      }
    }

    const existingIdx = victims.findIndex(
      (v) =>
        v.user_id === entry.user_id ||
        (entry.email && v.email && v.email.toLowerCase() === entry.email.toLowerCase()) ||
        (entry.codeword && v.codeword && v.codeword.toLowerCase() === entry.codeword.toLowerCase())
    );

    const fullRecord: RegisteredVictimRecord = {
      id: entry.id || entry.user_id,
      user_id: entry.user_id,
      name: entry.name,
      email: entry.email,
      phone: entry.phone,
      close_phone: entry.close_phone,
      keypad_code: entry.keypad_code,
      codeword: entry.codeword,
      auth_method: entry.auth_method || "traditional",
      share_personal_info: entry.share_personal_info ?? false,
      registered_at:
        entry.registered_at ||
        new Date().toLocaleString("en-IN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      latest_modality: entry.latest_modality || "text used",
      voice_stress_score: entry.voice_stress_score,
      voice_label: entry.voice_label,
      camera_distress_score: entry.camera_distress_score,
      primary_emotion: entry.primary_emotion,
      risk_level: entry.risk_level || "P3 - Routine",
      case_id: entry.case_id,
    };

    if (existingIdx >= 0) {
      victims[existingIdx] = { ...victims[existingIdx], ...fullRecord };
    } else {
      victims.unshift(fullRecord);
    }
    localStorage.setItem("sahayak_registered_victims", JSON.stringify(victims));
    notifyStoreChange();
  } catch (err) {
    console.error("Failed to save registered victim", err);
  }
}

/**
 * Syncs backend victim records into localStorage so getCases() and
 * getRegisteredVictims() include them on every heartbeat tick.
 * Safe to call repeatedly — fully idempotent (deduplicates by id/email).
 */
export function syncBackendVictimsToLocalStorage(
  backendVictims: Array<{
    id: string;
    user_id: string;
    name?: string;
    email?: string;
    phone?: string;
    vulnerability_category?: string;
    preferred_language?: string;
    registered_at?: string;
    auth_method?: "traditional" | "voice_keypad" | "opencv_camera";
    share_personal_info?: boolean;
  }>
): void {
  if (typeof window === "undefined") return;

  // --- 1. Merge into sahayak_registered_victims ---
  try {
    const raw = localStorage.getItem("sahayak_registered_victims");
    let existing: RegisteredVictimRecord[] = [];
    try { existing = raw ? JSON.parse(raw) : []; } catch { existing = []; }

    const seenIds = new Set(existing.map((v) => v.user_id));
    const seenEmails = new Set(
      existing.filter((v) => v.email).map((v) => v.email!.toLowerCase())
    );

    let changed = false;
    for (const bv of backendVictims) {
      if (!bv.name || bv.name === "[Decryption Failed]") continue;
      const emailKey = bv.email && bv.email !== "[Decryption Failed]"
        ? bv.email.toLowerCase() : null;
      if (seenIds.has(bv.user_id) || seenIds.has(bv.id) ||
          (emailKey !== null && seenEmails.has(emailKey))) continue;

      const cw_rec = bv.name.toLowerCase().replace(/\s+/g, "-").slice(0, 12) +
        `-${bv.id.slice(0, 4)}`;
      const bvId_rec = `backend-${bv.id}`;

      const record: RegisteredVictimRecord = {
        id: bv.id,
        user_id: bv.user_id,
        case_id: bvId_rec,
        codeword: cw_rec,
        name: bv.name,
        email: emailKey ? bv.email : undefined,
        phone: bv.phone && bv.phone !== "[Decryption Failed]" ? bv.phone : undefined,
        auth_method: bv.auth_method || "traditional",
        share_personal_info: bv.share_personal_info ?? true,
        registered_at: bv.registered_at
          ? new Date(bv.registered_at).toLocaleString("en-IN", {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })
          : "Intake Record",
        latest_modality: "text used",
        risk_level: "P3 - Routine",
      };
      existing.unshift(record);
      seenIds.add(bv.user_id);
      if (emailKey) seenEmails.add(emailKey);
      changed = true;
    }
    if (changed) {
      localStorage.setItem("sahayak_registered_victims", JSON.stringify(existing));
    }
  } catch {}

  // --- 2. Merge into sahayak_cases ---
  try {
    const rawCases = localStorage.getItem(STORAGE_KEYS.CASES);
    let existingCases: CounsellorCase[] = [];
    try { existingCases = rawCases ? JSON.parse(rawCases) : []; } catch { existingCases = []; }
    if (!Array.isArray(existingCases)) existingCases = [];

    const existingIds = new Set(existingCases.map((c) => c.id));
    const existingEmails = new Set(
      existingCases
        .filter((c) => c.victim_profile?.email)
        .map((c) => c.victim_profile!.email!.toLowerCase())
    );
    const existingCodewords = new Set(existingCases.map((c) => c.codeword));

    const toAdd: CounsellorCase[] = [];
    for (const bv of backendVictims) {
      if (!bv.name || bv.name === "[Decryption Failed]") continue;
      const bvId = `backend-${bv.id}`;
      if (existingIds.has(bvId)) continue;

      const emailKey = bv.email && bv.email !== "[Decryption Failed]"
        ? bv.email.toLowerCase() : null;
      if (emailKey && existingEmails.has(emailKey)) continue;

      const cw = bv.name.toLowerCase().replace(/\s+/g, "-").slice(0, 12) +
        `-${bv.id.slice(0, 4)}`;
      if (existingCodewords.has(cw)) continue;
      existingCodewords.add(cw);

      const dateLabel = bv.registered_at
        ? new Date(bv.registered_at).toLocaleDateString("en-IN", {
            month: "short", day: "numeric",
          })
        : "Intake";

      const synthCase: CounsellorCase = {
        id: bvId,
        case_id: `backend-${bv.id.slice(0, 8)}`,
        codeword: cw,
        triage_priority: "P3 - Routine",
        status: "new",
        share_personal_info: bv.share_personal_info ?? true,
        victim_profile: {
          ...(bv.name ? { name: bv.name } : {}),
          ...(emailKey ? { email: bv.email! } : {}),
          ...(bv.phone && bv.phone !== "[Decryption Failed]" ? { phone: bv.phone } : {}),
        },
        distress_trajectory: [{ date: "Intake", score: 0.3, event: "Backend signup" }],
        fieldNotes: [
          {
            id: `fn-${bvId}`,
            timestamp: dateLabel,
            author: "Intake Desk",
            text: `Intake case opened for ${bv.name}. Category: ${bv.vulnerability_category || "SC/ST PoA"}. Preferred language: ${bv.preferred_language || "hi"}.`,
          },
        ],
        interaction_history: [
          {
            id: `ih-${bvId}`,
            timestamp: dateLabel,
            text: `Victim intake registered via backend portal (${bv.vulnerability_category || "SC/ST PoA"}).`,
            source: "intake",
            risk_level: "LOW",
            modality: "text used",
          },
        ],
        latest_modality: "text used",
        signals: [
          (bv.share_personal_info ?? true) ? "Personal Info Disclosed" : "Strict Anonymous Shield",
          "PWA Secure",
          "Backend Intake",
        ],
        summary: `Victim registered on ${dateLabel}.`,
        last_interaction: dateLabel,
        created_at: dateLabel,
        ml_scores: {
          sentiment_label: "LOW",
          sentiment_score: 0.3,
          threat_flag: false,
          threat_prob: 0.1,
          composite_score: 0.28,
          confidence: 0.75,
          trend_flag: "STABLE",
        },
      };
      toAdd.push(synthCase);
      existingIds.add(bvId);
      if (emailKey) existingEmails.add(emailKey);
    }

    if (toAdd.length > 0) {
      const merged = [...toAdd, ...existingCases];
      localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(merged));
      notifyStoreChange();
    }
  } catch {}
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("sahayak_auth_user");
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function logoutUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("sahayak_access_token");
  localStorage.removeItem("sahayak_auth_role");
  localStorage.removeItem("sahayak_auth_user");
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_CODEWORD);
  notifyStoreChange();
}

export function syncVictimAccountAndCase(info: {
  email: string;
  name: string;
  phone?: string;
  close_phone?: string;
  keypad_code?: string;
  sharePersonalInfo: boolean;
  referralId?: string;
  user_id: string;
  auth_method?: "traditional" | "voice_keypad" | "opencv_camera";
}): string {
  if (typeof window === "undefined") return "";

  const normEmail = info.email.trim().toLowerCase();
  // Maintain persistent codeword per victim account
  let cw = localStorage.getItem(`sahayak_user_codeword_${normEmail}`);
  if (!cw) {
    cw = info.referralId ? info.referralId.toLowerCase() : generateCodeword();
    localStorage.setItem(`sahayak_user_codeword_${normEmail}`, cw);
  }

  // Update active codeword & share preference
  setActiveCodeword(cw);
  setVictimSharePreference({
    share: info.sharePersonalInfo,
    name: info.sharePersonalInfo ? info.name : undefined,
    email: info.sharePersonalInfo ? info.email : undefined,
    phone: info.sharePersonalInfo ? info.phone : undefined,
  });

  // Save auth user object with codeword, auth method and explicit share preference
  const authMethod = info.auth_method || "traditional";
  const authUser: AuthUser = {
    user_id: info.user_id,
    email: info.email,
    name: info.name,
    role: "victim",
    phone: info.phone,
    close_phone: info.close_phone,
    keypad_code: info.keypad_code,
    codeword: cw,
    share_personal_info: info.sharePersonalInfo,
    auth_method: authMethod,
  };
  localStorage.setItem("sahayak_auth_user", JSON.stringify(authUser));

  saveRegisteredVictim({
    user_id: info.user_id,
    name: info.name,
    email: info.email,
    phone: info.phone,
    close_phone: info.close_phone,
    keypad_code: info.keypad_code,
    codeword: cw,
    auth_method: authMethod,
    share_personal_info: info.sharePersonalInfo,
    latest_modality: authMethod === "opencv_camera" ? "camera used" : authMethod === "voice_keypad" ? "voice used" : "text used",
  });

  // Auto-record Day 1 Intake Check-in (counts as first check-in, modality: text used)
  const todayStr = new Date().toISOString().split("T")[0];
  const allCheckins = getCheckIns();
  let intakeCheckin: CheckInEntry | undefined;
  if (!allCheckins.some((c) => c.date === todayStr)) {
    intakeCheckin = saveCheckIn({
      date: todayStr,
      mood: 3,
      moodLabel: "Intake Established",
      sleepHours: 7,
      sleepQuality: "Normal",
      feelings: ["Seeking sanctuary", "Intake recorded"],
      reflection: "Initial intake check-in created upon victim sign-up.",
      modality: "text used",
      threat_prob: 0.14,
      threat_flag: false,
      sentiment_score: 0.35,
      sentiment_label: "LOW",
    });
  }

  // Sync with CounsellorCase immediately so counsellor views live status
  const cases = getCases();
  let targetCase = cases.find((c) => c.codeword === cw || c.case_id === cw);
  let updatedCases: CounsellorCase[];

  const victimProfile = {
    name: info.name,
    email: info.email,
    phone: info.phone,
    close_phone: info.close_phone,
    keypad_code: info.keypad_code,
  };

  if (targetCase) {
    updatedCases = cases.map((c) => {
      if (c.id === targetCase!.id) {
        return {
          ...c,
          latest_modality: "text used" as const,
          share_personal_info: info.sharePersonalInfo,
          victim_profile: victimProfile,
          signals: Array.from(new Set([
            ...c.signals.filter((s) => !s.includes("voice used") && !s.includes("text used") && s !== "Strict Anonymous Shield" && s !== "Personal Info Disclosed"),
            info.sharePersonalInfo ? "Personal Info Disclosed" : "Strict Anonymous Shield",
            "text used (intake)",
          ])),
        };
      }
      return c;
    });
  } else {
    const newCaseId = `case-${Math.floor(1000 + Math.random() * 9000)}`;
    const createdCase: CounsellorCase = {
      id: newCaseId,
      case_id: newCaseId,
      codeword: cw,
      triage_priority: "P3 - Routine",
      status: "new",
      share_personal_info: info.sharePersonalInfo,
      victim_profile: victimProfile,
      distress_trajectory: [{ date: "Intake", score: 0.35, event: "Sign-up (text used)" }],
      fieldNotes: [
        {
          id: `fn_${Date.now()}`,
          timestamp: "Just now",
          author: "Intake Desk",
          text: `Support dossier initiated for ${info.name}. Auth method: ${authMethod}. Personal info shared: ${info.sharePersonalInfo ? "Yes" : "Confidential shield"}.`,
        },
      ],
      interaction_history: [
        {
          id: `hist_${Date.now()}`,
          timestamp: "Just now",
          text: "Victim completed intake onboarding via web portal.",
          source: "intake",
          risk_level: "LOW",
          modality: "text used",
        },
      ],
      latest_modality: "text used",
      latest_checkin: intakeCheckin,
      signals: [
        info.sharePersonalInfo ? "Personal Info Disclosed" : "Strict Anonymous Shield",
        "PWA Secure",
        "text used",
      ],
      summary: "Case initiated via victim intake portal.",
      last_interaction: "Just now",
      created_at: new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      ml_scores: {
        sentiment_label: "LOW",
        sentiment_score: 0.35,
        threat_flag: false,
        threat_prob: 0.14,
        voice_stress_score: 0.25,
        voice_label: "NOT_STRESSED",
        composite_score: 0.32,
        confidence: 0.88,
        trend_flag: "STABLE",
      },
    };
    updatedCases = [createdCase, ...cases];
  }

  localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(updatedCases));
  notifyStoreChange();
  return cw;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const b64 = res.includes(",") ? res.split(",")[1] : res;
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function submitVoiceCheckIn(params: {
  audioBlob?: Blob;
  audioBase64?: string;
  durationSeconds: number;
  transcript?: string;
}): Promise<CheckInEntry> {
  const todayStr = new Date().toISOString().split("T")[0];
  let voiceStress: number | null = null;
  let voiceLabel: "STRESSED" | "NOT_STRESSED" = "NOT_STRESSED";

  let b64 = params.audioBase64;
  if (!b64 && params.audioBlob) {
    try {
      b64 = await blobToBase64(params.audioBlob);
    } catch (e) {
      console.warn("Failed to convert audio blob to base64:", e);
    }
  }

  // 1. Call the unified backend gateway on port 8400: /api/v1/perception/voice-score
  try {
    if (b64) {
      const res = await fetch("http://localhost:8400/api/v1/perception/voice-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_base64: b64,
          duration_seconds: params.durationSeconds || 5,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const score = data.voice_stress_score ?? data.score ?? data.prob_stressed;
        if (typeof score === "number") {
          voiceStress = Number(score.toFixed(3));
        }
        const label = data.label ?? data.voice_label;
        if (label === "STRESSED" || label === "NOT_STRESSED") {
          voiceLabel = label;
        } else if (voiceStress !== null) {
          voiceLabel = voiceStress >= 0.5 ? "STRESSED" : "NOT_STRESSED";
        }
      }
    }
  } catch (e) {
    console.warn("Backend gateway :8400 voice-score call failed, trying direct :8100:", e);
  }

  // 2. If not yet resolved, try calling Sohon directly on port 8100
  if (voiceStress === null && b64) {
    try {
      const res = await fetch("http://127.0.0.1:8100/v1/signals/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_base64: b64 }),
      });
      if (res.ok) {
        const data = await res.json();
        const score = data.voice?.voice_stress_score ?? data.voice_stress_score;
        if (typeof score === "number") {
          voiceStress = Number(score.toFixed(3));
        }
        const label = data.voice?.label ?? data.voice_label;
        if (label === "STRESSED" || label === "NOT_STRESSED") {
          voiceLabel = label;
        } else if (voiceStress !== null) {
          voiceLabel = voiceStress >= 0.5 ? "STRESSED" : "NOT_STRESSED";
        }
      }
    } catch (e) {
      console.warn("Direct Sohon :8100 call failed:", e);
    }
  }

  // Fallback only if both servers are completely down
  if (voiceStress === null) {
    voiceStress = 0.68;
    voiceLabel = "STRESSED";
  }

  const newCheckIn = saveCheckIn({
    date: todayStr,
    mood: voiceStress > 0.65 ? 2 : voiceStress > 0.45 ? 3 : 4,
    moodLabel: voiceLabel === "STRESSED" ? "Elevated Vocal Stress" : "Calm & Grounded",
    sleepHours: 6,
    sleepQuality: "Normal",
    feelings: voiceLabel === "STRESSED" ? ["Vocal tension", "Heavy load"] : ["Vocal unburdening", "Centered"],
    reflection: params.transcript || `IVRS voice check-in recorded (${params.durationSeconds}s clip). Acoustic model evaluated.`,
    modality: "voice used",
    voice_stress_score: voiceStress,
    voice_label: voiceLabel,
  });

  // Sync with active counsellor case
  const activeCw = getActiveCodeword();
  if (activeCw) {
    const cases = getCases();
    const updated = cases.map((c) => {
      if (c.codeword === activeCw || c.case_id === activeCw) {
        return {
          ...c,
          latest_modality: "voice used" as const,
          latest_checkin: newCheckIn,
          last_interaction: "Just now (Voice Check-in)",
          signals: Array.from(new Set([
            ...c.signals.filter((s) => !s.includes("voice used") && !s.includes("text used")),
            `voice used (stress ${(voiceStress * 100).toFixed(0)}%)`,
          ])),
          ml_scores: {
            ...(c.ml_scores || {
              sentiment_label: "LOW",
              sentiment_score: 0.3,
              threat_flag: false,
              threat_prob: 0.1,
              composite_score: 0.35,
              confidence: 0.85,
              trend_flag: "STABLE",
            }),
            voice_stress_score: voiceStress,
            voice_label: voiceLabel,
            has_voice_recording: true,
            composite_score: Math.min(0.95, (c.ml_scores?.composite_score || 0.4) * 0.4 + voiceStress * 0.6),
          },
          distress_trajectory: [
            ...(c.distress_trajectory || []),
            { date: "Today", score: Number(voiceStress.toFixed(2)), event: "IVRS Voice Check-in (voice used)" },
          ],
        };
      }
      return c;
    });
    localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(updated));
    notifyStoreChange();
  }

  return newCheckIn;
}

export function signInWithKeypadCode(phone: string, keypadCode: string): AuthUser | null {
  if (typeof window === "undefined") return null;
  const cleanPhone = phone.trim().replace(/\s+/g, "");
  const cleanCode = keypadCode.trim();

  // Search existing cases
  const rawCases = localStorage.getItem(STORAGE_KEYS.CASES);
  if (rawCases) {
    try {
      const cases: CounsellorCase[] = JSON.parse(rawCases);
      const matched = cases.find(
        (c) =>
          c.victim_profile?.phone?.replace(/\s+/g, "").endsWith(cleanPhone.slice(-10)) &&
          c.victim_profile?.keypad_code === cleanCode
      );
      if (matched) {
        const user: AuthUser = {
          user_id: matched.id,
          name: matched.victim_profile?.name || "Anonymous Traveler",
          email: matched.victim_profile?.email || `${matched.codeword}@sahayak.gov.in`,
          role: "victim",
          phone: matched.victim_profile?.phone,
          close_phone: matched.victim_profile?.close_phone,
          keypad_code: cleanCode,
          codeword: matched.codeword,
          share_personal_info: matched.share_personal_info,
          auth_method: "voice_keypad",
        };
        saveRegisteredVictim({
          user_id: matched.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          close_phone: user.close_phone,
          keypad_code: cleanCode,
          codeword: matched.codeword,
          auth_method: "voice_keypad",
          share_personal_info: !!matched.share_personal_info,
          latest_modality: "voice used",
        });
        localStorage.setItem("sahayak_access_token", `token_keypad_${Date.now()}`);
        localStorage.setItem("sahayak_auth_role", "victim");
        localStorage.setItem("sahayak_auth_user", JSON.stringify(user));
        setActiveCodeword(matched.codeword);
        notifyStoreChange();
        return user;
      }
    } catch {}
  }

  // Check stored auth user
  const rawUser = localStorage.getItem("sahayak_auth_user");
  if (rawUser) {
    try {
      const user: AuthUser = JSON.parse(rawUser);
      if (
        user.phone?.replace(/\s+/g, "").endsWith(cleanPhone.slice(-10)) &&
        user.keypad_code === cleanCode
      ) {
        localStorage.setItem("sahayak_access_token", `token_keypad_${Date.now()}`);
        localStorage.setItem("sahayak_auth_role", "victim");
        setActiveCodeword(user.codeword || "");
        notifyStoreChange();
        return user;
      }
    } catch {}
  }

  return null;
}

export async function submitCameraCheckIn(params: {
  frames: string[];
  durationSeconds: number;
  averageScores?: {
    average_distress_score?: number;
    primary_emotion?: string;
    average_emotions?: Record<string, number>;
  };
}): Promise<CheckInEntry> {
  const todayStr = new Date().toISOString().split("T")[0];
  let avgDistress = params.averageScores?.average_distress_score ?? 0.65;
  let primaryEmotion = params.averageScores?.primary_emotion ?? "SADNESS";
  let emotionDistribution = params.averageScores?.average_emotions || {};

  // Try calling backend OpenCV session average endpoint (:8400/api/v1/perception/camera-average)
  try {
    if (params.frames && params.frames.length > 0) {
      const res = await fetch("http://localhost:8400/api/v1/perception/camera-average", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frames: params.frames,
          session_seconds: params.durationSeconds || 5,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.average_distress_score === "number") {
          avgDistress = data.average_distress_score;
        }
        if (data.primary_emotion) {
          primaryEmotion = data.primary_emotion;
        }
        if (data.average_emotions) {
          emotionDistribution = data.average_emotions;
        }
      }
    }
  } catch (err) {
    console.warn("Backend camera averaging endpoint error, using local computation:", err);
  }

  // Map distress to mood: High distress (e.g. sadness, crying, tension) -> Fragile (1) / Heavy (2)
  const isDistressedEmotion = ["SADNESS", "FEAR", "ANGER", "DISGUST", "CONTEMPT"].includes(primaryEmotion);
  const moodVal: 1 | 2 | 3 | 4 | 5 =
    avgDistress > 0.65 ? 1 :
    avgDistress > 0.45 || isDistressedEmotion ? 2 :
    avgDistress > 0.30 ? 3 :
    avgDistress > 0.18 ? 4 : 5;

  const newCheckIn = saveCheckIn({
    date: todayStr,
    mood: moodVal,
    moodLabel: `Visual ${primaryEmotion} (${(avgDistress * 100).toFixed(0)}% distress)`,
    sleepHours: isDistressedEmotion ? 5 : 7,
    sleepQuality: isDistressedEmotion ? "Restless" : "Normal",
    feelings: [primaryEmotion, avgDistress > 0.45 ? "Emotional Strain" : "Visual Calm"],
    reflection: `Live camera emotion check-in (${params.durationSeconds || 5}s OpenCV scan). Primary emotion: ${primaryEmotion}. Session average distress: ${(avgDistress * 100).toFixed(0)}%.`,
    modality: "camera used",
    camera_distress_score: avgDistress,
    primary_emotion: primaryEmotion,
    emotion_scores: emotionDistribution,
  });

  // Sync with active counsellor case
  const activeCw = getActiveCodeword();
  if (activeCw) {
    const cases = getCases();
    const updated = cases.map((c) => {
      if (c.codeword === activeCw || c.case_id === activeCw) {
        return {
          ...c,
          latest_modality: "camera used" as const,
          latest_source: "camera_checkin" as const,
          latest_checkin: newCheckIn,
          last_interaction: "Just now (Camera Emotion Check-in)",
          signals: Array.from(new Set([
            ...c.signals.filter((s) => !s.includes("voice used") && !s.includes("camera used")),
            `camera used (${primaryEmotion} distress ${(avgDistress * 100).toFixed(0)}%)`,
          ])),
          ml_scores: {
            ...(c.ml_scores || {
              sentiment_label: "LOW",
              sentiment_score: 0.3,
              threat_flag: false,
              threat_prob: 0.1,
              composite_score: 0.35,
              confidence: 0.85,
              trend_flag: "STABLE",
            }),
            camera_distress_score: avgDistress,
            primary_emotion: primaryEmotion,
            composite_score: Math.min(0.95, (c.ml_scores?.composite_score || 0.4) * 0.4 + avgDistress * 0.6),
          },
          distress_trajectory: [
            ...(c.distress_trajectory || []),
            { date: "Today", score: Number(avgDistress.toFixed(2)), event: `OpenCV Camera Scan (camera used · ${primaryEmotion})` },
          ],
        };
      }
      return c;
    });
    localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(updated));
    notifyStoreChange();
  }

  return newCheckIn;
}

export function signInWithCamera(params?: {
  faceSnapshot?: string;
  distressScore?: number;
  primaryEmotion?: string;
}): AuthUser {
  const existing = getCurrentUser();
  const codeword = existing?.codeword || generateCodeword();
  const userId = `victim_cam_${Date.now()}`;
  const user: AuthUser = {
    user_id: userId,
    name: existing?.name || "Cam-Verified Traveler",
    email: existing?.email || `cam_victim_${Date.now()}@sahayak.gov.in`,
    role: "victim",
    codeword,
    phone: existing?.phone || "",
    keypad_code: existing?.keypad_code || "*7#",
    auth_method: "opencv_camera",
  };
  saveRegisteredVictim({
    user_id: userId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    keypad_code: user.keypad_code,
    codeword,
    auth_method: "opencv_camera",
    share_personal_info: false,
    latest_modality: "camera used",
    camera_distress_score: params?.distressScore,
    primary_emotion: params?.primaryEmotion,
  });

  localStorage.setItem("sahayak_access_token", `token_cam_${Date.now()}`);
  localStorage.setItem("sahayak_auth_role", "victim");
  localStorage.setItem("sahayak_auth_user", JSON.stringify(user));
  setActiveCodeword(codeword);

  syncVictimAccountAndCase({
    email: user.email,
    name: user.name,
    phone: user.phone,
    sharePersonalInfo: false,
    referralId: user.keypad_code,
    user_id: userId,
  });

  if (params?.distressScore !== undefined) {
    submitCameraCheckIn({
      frames: params.faceSnapshot ? [params.faceSnapshot] : [],
      durationSeconds: 3,
      averageScores: {
        average_distress_score: params.distressScore,
        primary_emotion: params.primaryEmotion || "NEUTRAL",
      },
    });
  }

  notifyStoreChange();
  return user;
}

// Triage Alerts
export function getAlerts(): TriageAlert[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEYS.ALERTS);
  if (!raw) return seedInitialAlerts();
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function decideAlert(alertId: string, approved: boolean, note?: string): void {
  const alerts = getAlerts();
  const updated = alerts.map((a) => {
    if (a.alert_id === alertId) {
      return {
        ...a,
        decision_status: approved ? ("approved" as const) : ("rejected" as const),
        counsellor_note: note || (approved ? "Approved by counsellor on duty" : "De-escalated to routine checkin"),
      };
    }
    return a;
  });
  localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(updated));
  notifyStoreChange();
}

// Counsellor Cases
export function getCases(): CounsellorCase[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEYS.CASES);
  if (!raw) return seedInitialCases();
  try {
    const parsed: CounsellorCase[] = JSON.parse(raw);
    // Sanitize: strictly retain clinician notes in fieldNotes (strip out any victim chat/questionnaire strings)
    return parsed.map((c) => ({
      ...c,
      fieldNotes: (c.fieldNotes || []).filter((n) => !n.author.toLowerCase().includes("victim")),
    }));
  } catch {
    return [];
  }
}

export function getCaseById(id: string): CounsellorCase | undefined {
  const cases = getCases();
  return cases.find((c) => c.id === id || c.case_id === id || c.codeword === id);
}

export function updateCaseStatus(id: string, status: CounsellorCase["status"]): void {
  const cases = getCases();
  const updated = cases.map((c) => {
    if (c.id === id || c.case_id === id) {
      return { ...c, status, last_interaction: "Just now" };
    }
    return c;
  });
  localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(updated));

  // Sync to requests if applicable
  const reqs = getHelpRequests();
  const updatedReqs = reqs.map((r) => (r.id === id || r.codeword === id ? { ...r, status } : r));
  localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(updatedReqs));
  notifyStoreChange();
}

export function addCaseNote(id: string, noteText: string, author = "Dr. Ananya Roy"): void {
  const cases = getCases();
  const newNote: CaseNote = {
    id: `note_${Date.now()}`,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    author,
    text: noteText,
  };
  const updated = cases.map((c) => {
    if (c.id === id || c.case_id === id) {
      return {
        ...c,
        fieldNotes: [newNote, ...c.fieldNotes],
        last_interaction: "Just now",
      };
    }
    return c;
  });
  localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(updated));
  notifyStoreChange();
}

export function saveDecisionTrace(trace: DecisionTrace): void {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(STORAGE_KEYS.TRACES);
  let traces: Record<string, DecisionTrace> = {};
  if (raw) {
    try {
      traces = JSON.parse(raw);
    } catch {
      traces = {};
    }
  }
  traces[trace.thread_id] = trace;
  localStorage.setItem(STORAGE_KEYS.TRACES, JSON.stringify(traces));
  notifyStoreChange();
}

// Decision Trace audit retrieval
export function getDecisionTrace(threadId: string): DecisionTrace {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(STORAGE_KEYS.TRACES);
    if (raw) {
      try {
        const stored = JSON.parse(raw);
        if (stored[threadId]) return stored[threadId];
      } catch (e) {
        console.error("Failed to parse stored traces", e);
      }
    }
  }

  const traces: Record<string, DecisionTrace> = {
    "thread-8492": {
      thread_id: "thread-8492",
      case_id: "case-9412",
      decision: {
        route: "crisis",
        policy_version: "v2.4.1-safety",
        reasons: [
          "Urgent crisis keywords detected in interaction sequence",
          "Distress slope delta exceeded +0.48 across 48h check-in ladder",
          "Consent scope verified: CHAT_ANALYSIS and ESCALATION_LADDER active",
          "Multi-signal fusion triggered priority override",
        ],
      },
      fusion: {
        confidence: 0.94,
        top_signals: ["lexical_urgency (0.96)", "missed_checkin_weight (0.88)", "sleep_deficit (0.82)"],
      },
      errors: [],
      victim_text: "I don't think I can make it through tonight. Please help me before I do something to myself.",
    },
    "thread-6218": {
      thread_id: "thread-6218",
      case_id: "case-8820",
      decision: {
        route: "escalate",
        policy_version: "v2.4.1-safety",
        reasons: [
          "Sustained 4-day isolation indicators",
          "Victim requested quiet callback window between 6 PM - 8 PM",
          "No immediate crisis language, but safety ladder recommended review",
        ],
      },
      fusion: {
        confidence: 0.86,
        top_signals: ["callback_urgency (0.89)", "sentiment_dampening (0.84)"],
      },
      errors: ["Voice signal telemetry unavailable (opted out by user)"],
      victim_text: "Feeling so isolated and scared to step out of the house. Need a quiet callback.",
    },
  };

  return (
    traces[threadId] || {
      thread_id: threadId,
      case_id: "case-live",
      decision: {
        route: "routine",
        policy_version: "v2.4.1-safety",
        reasons: ["Standard wellbeing checkin within normal threshold"],
      },
      fusion: {
        confidence: 0.78,
        top_signals: ["baseline_stability (0.80)"],
      },
      errors: [],
      victim_text: "Today was quiet. Walking by the river helped a lot.",
    }
  );
}

// Safety-critical Quick Exit
export function executeQuickExit(): void {
  try {
    localStorage.clear();
    sessionStorage.clear();
    // Clear cookies
    if (typeof document !== "undefined") {
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    }
  } catch (err) {
    console.error("Quick exit error:", err);
  }
  // Immediately navigate to innocent search page
  window.location.replace("https://www.google.com/search?q=weather+today");
}

export interface VictimInteractionScores {
  sentiment: {
    label: "LOW" | "MODERATE" | "HIGH";
    sentiment_score: number;
    confidence: number;
    model_version?: string;
  };
  threat: {
    threat_flag: boolean;
    prob: number;
    confidence: number;
    model_version?: string;
  };
  fusion?: {
    composite_score: number;
    confidence: number;
    label: "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";
    triggers: string[];
    top_signals: string[];
    contributions?: Record<string, number>;
    weights?: Record<string, number>;
    posterior_std?: number;
    conflict?: boolean;
    conflict_chi2?: number;
  };
  composite_score?: number;
  trigger_words?: string[];
}

export function recordVictimInteraction(
  userText: string,
  scores: VictimInteractionScores
): { caseId: string; threadId: string; alertId?: string } {
  const cases = getCases();
  const currentUser = getCurrentUser();
  let codeword = currentUser?.codeword || getActiveCodeword();
  if (!codeword) {
    codeword = generateCodeword();
    setActiveCodeword(codeword);
  }

  const threadId = `thread-${Math.floor(1000 + Math.random() * 9000)}`;
  const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const isThreat = scores.threat.threat_flag || scores.threat.prob >= 0.70;
  const isCritical =
    scores.fusion?.label === "CRITICAL" ||
    isThreat ||
    (scores.fusion?.triggers && scores.fusion.triggers.includes("threat_force"));
  const isHighRisk =
    isCritical ||
    scores.fusion?.label === "HIGH" ||
    scores.sentiment.sentiment_score >= 0.65;

  const compositeScore =
    scores.fusion?.composite_score ??
    scores.composite_score ??
    Number(((scores.sentiment.sentiment_score * 0.262) + (scores.threat.prob * 0.590) + (0.35 * 0.148)).toFixed(2));

  const confidenceScore =
    scores.fusion?.confidence ??
    Number(((scores.sentiment.confidence + scores.threat.confidence) / 2).toFixed(2));

  const sharePref = getVictimSharePreference();

  const historyItem: VictimHistoryItem = {
    id: `vhist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: `${new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric" })} ${nowTime}`,
    text: userText,
    source: "chat",
    risk_level: isCritical ? "CRITICAL" : isHighRisk ? "HIGH" : "MODERATE",
    details: `MuRIL: ${scores.sentiment.label} (${(scores.sentiment.sentiment_score * 100).toFixed(0)}%) · Threat: ${scores.threat.threat_flag ? "FLAGGED" : "CLEAR"}`,
  };

  // Find existing case or create a new one
  let targetCase = cases.find((c) => c.codeword === codeword || c.case_id === codeword);
  let updatedCases: CounsellorCase[];

  const newNote: CaseNote = {
    id: `fn_msg_${Date.now()}`,
    timestamp: nowTime,
    author: isCritical ? "VICTIM (CRITICAL FUSION ALERT)" : "Victim (Live Chat)",
    text: userText,
  };

  const trendFlag = isCritical ? "ESCALATING" : isHighRisk ? "ESCALATING" : "STABLE";
  const priorityStr = isCritical
    ? "P1 - Immediate"
    : isHighRisk
    ? "P2 - Within 2h"
    : "P3 - Routine";

  if (targetCase) {
    const newTraj = [
      ...targetCase.distress_trajectory,
      {
        date: "Today " + nowTime,
        score: Number(compositeScore.toFixed(2)),
        event: isCritical ? "Crisis Fusion Warning" : "Live chat interaction",
      },
    ];

    const currentHistory = targetCase.interaction_history || [];
    const updatedHistory = [...currentHistory, historyItem];

    updatedCases = cases.map((c) => {
      if (c.id === targetCase!.id) {
        return {
          ...c,
          summary: userText.length > 120 ? userText.slice(0, 117) + "..." : userText,
          last_interaction: "Just now",
          triage_priority: priorityStr,
          distress_trajectory: newTraj,
          fieldNotes: c.fieldNotes,
          interaction_history: updatedHistory,
          share_personal_info: sharePref.share,
          victim_profile: sharePref.share
            ? (c.victim_profile || (sharePref.name ? { name: sharePref.name, email: sharePref.email, phone: sharePref.phone } : undefined))
            : undefined,
          status: c.status === "resolved" ? "in_support" : c.status, // Reopen case if closed
          signals: Array.from(new Set([
            ...c.signals,
            `Fusion: ${scores.fusion?.label || (isCritical ? "CRITICAL" : "ELEVATED")}`,
            `Distress: ${scores.sentiment.label}`,
            scores.threat.threat_flag ? "Threat Flagged" : "Threat Clear",
            "Live Sanctuary Stream",
          ])),
          ml_scores: {
            sentiment_label: scores.sentiment.label,
            sentiment_score: Number(scores.sentiment.sentiment_score.toFixed(2)),
            threat_flag: scores.threat.threat_flag,
            threat_prob: Number(scores.threat.prob.toFixed(2)),
            voice_stress_score: c.ml_scores?.has_voice_recording ? c.ml_scores.voice_stress_score : undefined,
            voice_label: c.ml_scores?.has_voice_recording ? c.ml_scores.voice_label : undefined,
            has_voice_recording: c.ml_scores?.has_voice_recording || false,
            composite_score: Number(compositeScore.toFixed(2)),
            confidence: confidenceScore,
            trend_flag: trendFlag,
          },
        };
      }
      return c;
    });
  } else {
    const newCaseId = `case-${Math.floor(1000 + Math.random() * 9000)}`;
    const createdCase: CounsellorCase = {
      id: newCaseId,
      case_id: newCaseId,
      codeword,
      triage_priority: priorityStr,
      status: "new",
      distress_trajectory: [
        { date: "Intake", score: 0.35 },
        {
          date: "Today " + nowTime,
          score: Number(compositeScore.toFixed(2)),
          event: isCritical ? "Urgent Crisis Flagged" : "Live Chat Interaction",
        },
      ],
      fieldNotes: [],
      interaction_history: [historyItem],
      share_personal_info: sharePref.share,
      victim_profile: sharePref.share ? { name: sharePref.name, email: sharePref.email, phone: sharePref.phone } : undefined,
      signals: [
        `Fusion: ${scores.fusion?.label || (isCritical ? "CRITICAL" : "ELEVATED")}`,
        `Distress: ${scores.sentiment.label}`,
        scores.threat.threat_flag ? "Threat Flagged" : "Threat Clear",
        "Sanctuary Chat",
      ],
      summary: userText.length > 120 ? userText.slice(0, 117) + "..." : userText,
      last_interaction: "Just now",
      created_at: new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      ml_scores: {
        sentiment_label: scores.sentiment.label,
        sentiment_score: Number(scores.sentiment.sentiment_score.toFixed(2)),
        threat_flag: scores.threat.threat_flag,
        threat_prob: Number(scores.threat.prob.toFixed(2)),
        has_voice_recording: false,
        composite_score: Number(compositeScore.toFixed(2)),
        confidence: confidenceScore,
        trend_flag: trendFlag,
      },
    };
    targetCase = createdCase;
    updatedCases = [createdCase, ...cases];
  }

  localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(updatedCases));

  let alertId: string | undefined = undefined;

  // If elevated or critical risk, automatically inject into Triage Alert Queue and generate Decision Trace!
  if (isHighRisk || isCritical) {
    alertId = `alt-${Math.floor(1000 + Math.random() * 9000)}`;
    const riskLevel = isCritical ? "CRITICAL" : "HIGH";

    const reasons: string[] = [];
    if (scores.threat.threat_flag || scores.threat.prob >= 0.70) {
      reasons.push(`🚨 Threat classifier flagged high danger (P=${(scores.threat.prob * 100).toFixed(0)}%)`);
    }
    if (scores.fusion?.triggers && scores.fusion.triggers.includes("threat_force")) {
      reasons.push(`⚡ Bayesian Fusion Trigger: threat_force override engaged (risk floored at 0.80)`);
    }
    if (scores.sentiment.sentiment_score >= 0.65) {
      reasons.push(`Distress indicator elevated (MuRIL score ${(scores.sentiment.sentiment_score * 100).toFixed(0)}%)`);
    }
    reasons.push(`Victim snippet: "${userText.slice(0, 85)}${userText.length > 85 ? "..." : ""}"`);
    reasons.push(`Safety protocol: human counsellor review and active response required`);

    const newAlert: TriageAlert = {
      alert_id: alertId,
      case_id: targetCase.case_id,
      thread_id: threadId,
      risk_level: riskLevel,
      composite_score: Number(compositeScore.toFixed(2)),
      confidence: confidenceScore,
      triage_priority_score: Math.round(compositeScore * 100),
      raised_at: "Just now",
      decision_status: "pending",
      reasons,
      channel: "pwa_chat",
      victim_text: userText,
      trigger_words: scores.trigger_words || [],
      victim_info: {
        codeword: targetCase.codeword,
        share_personal_info: !!(targetCase.share_personal_info ?? sharePref.share),
        name: (targetCase.victim_profile?.name || sharePref.name),
        email: (targetCase.victim_profile?.email || sharePref.email),
        latest_mood: targetCase.latest_checkin?.moodLabel,
        latest_sleep: targetCase.latest_checkin ? `${targetCase.latest_checkin.sleepHours}h (${targetCase.latest_checkin.sleepQuality})` : undefined,
        history_count: ((targetCase.interaction_history || []).length) + 1,
      },
      history: [...(targetCase.interaction_history || []), historyItem],
    };

    const existingAlerts = getAlerts();
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify([newAlert, ...existingAlerts]));

    // Generate matching Explainable Decision Trace for the audit trail
    const traceSignals = scores.fusion?.top_signals?.length
      ? scores.fusion.top_signals.map((s) => {
          if (s === "threat") return `threat_detector (${(scores.threat.prob * 100).toFixed(0)}%)`;
          if (s === "sentiment") return `muril_distress (${(scores.sentiment.sentiment_score * 100).toFixed(0)}%)`;
          if (s === "voice_stress") return `voice_stress_sensor (35%)`;
          return s;
        })
      : [
          `muril_distress (${(scores.sentiment.sentiment_score * 100).toFixed(0)}%)`,
          `threat_detector (${(scores.threat.prob * 100).toFixed(0)}%)`,
          `chat_sentiment (${scores.sentiment.label})`,
        ];

    const trace: DecisionTrace = {
      thread_id: threadId,
      case_id: targetCase.case_id,
      decision: {
        route: isCritical ? "crisis" : "escalate",
        policy_version: "v2.4.1-safety",
        reasons,
      },
      fusion: {
        confidence: confidenceScore,
        top_signals: traceSignals,
      },
      errors: [],
      victim_text: userText,
    };
    saveDecisionTrace(trace);
  }

  notifyStoreChange();
  return { caseId: targetCase.case_id, threadId, alertId };
}

export function recordVictimQuestionnaire(entry: CheckInEntry): void {
  const cases = getCases();
  let codeword = getActiveCodeword();
  if (!codeword) {
    codeword = generateCodeword();
    setActiveCodeword(codeword);
  }

  const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Map mood (1..5) and sleep metrics to latent distress index
  // Mood 1 (Fragile) -> 0.88, Mood 2 (Heavy) -> 0.70, Mood 3 (Steady) -> 0.48, Mood 4 (Grounded) -> 0.28, Mood 5 (Light) -> 0.12
  const baseDistress = entry.mood === 1 ? 0.88 : entry.mood === 2 ? 0.70 : entry.mood === 3 ? 0.48 : entry.mood === 4 ? 0.28 : 0.12;
  const sleepPenalty = entry.sleepHours <= 4 ? 0.08 : entry.sleepHours <= 5.5 ? 0.04 : 0;
  const computedDistress = Math.min(0.98, Math.max(0.08, baseDistress + sleepPenalty));

  const isCritical = entry.mood === 1 && (entry.sleepHours <= 4 || (entry.reflection && /kill|die|suicide|hurt|threat|follow|harm/i.test(entry.reflection)));
  const isElevated = isCritical || entry.mood <= 2 || entry.sleepHours <= 4;

  const noteText = `[Daily Questionnaire Completed] Mood: ${entry.moodLabel} (${entry.mood}/5) · Sleep: ${entry.sleepHours}h (${entry.sleepQuality}) · Feelings: [${entry.feelings.join(", ")}]${entry.reflection ? ` · Written Reflection: "${entry.reflection}"` : ""}`;

  const newNote: CaseNote = {
    id: `fn_chk_${Date.now()}`,
    timestamp: nowTime,
    author: isCritical ? "VICTIM (CRITICAL QUESTIONNAIRE)" : "Victim (Check-in Questionnaire)",
    text: noteText,
  };

  const priorityStr = isCritical ? "P1 - Immediate" : isElevated ? "P2 - Within 2h" : "P3 - Routine";

  let targetCase = cases.find((c) => c.codeword === codeword || c.case_id === codeword);
  let updatedCases: CounsellorCase[];

  const summaryText = `[Questionnaire] Felt ${entry.moodLabel} (${entry.sleepHours}h rest)${entry.reflection ? `: "${entry.reflection}"` : ` with feelings: ${entry.feelings.slice(0, 3).join(", ")}`}`;

  const sharePref = getVictimSharePreference();

  const qHistoryItem: VictimHistoryItem = {
    id: `vhist_q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: `${new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric" })} ${nowTime}`,
    text: `Felt ${entry.moodLabel} (${entry.mood}/5) · Rest: ${entry.sleepHours}h (${entry.sleepQuality})${entry.reflection ? ` · "${entry.reflection}"` : ""}`,
    source: "questionnaire",
    risk_level: isCritical ? "CRITICAL" : isElevated ? "HIGH" : "LOW",
    details: `Feelings: ${entry.feelings.join(", ")}`,
  };

  if (targetCase) {
    const newTraj = [
      ...targetCase.distress_trajectory,
      {
        date: "Today " + nowTime,
        score: Number(computedDistress.toFixed(2)),
        event: `Questionnaire (${entry.moodLabel})`,
      },
    ];

    const currentHistory = targetCase.interaction_history || [];
    const updatedHistory = [...currentHistory, qHistoryItem];

    updatedCases = cases.map((c) => {
      if (c.id === targetCase!.id) {
        return {
          ...c,
          summary: summaryText.length > 120 ? summaryText.slice(0, 117) + "..." : summaryText,
          last_interaction: "Just now",
          triage_priority: isCritical ? "P1 - Immediate" : isElevated && !c.triage_priority.startsWith("P1") ? "P2 - Within 2h" : c.triage_priority,
          distress_trajectory: newTraj,
          fieldNotes: c.fieldNotes,
          interaction_history: updatedHistory,
          share_personal_info: sharePref.share,
          victim_profile: sharePref.share
            ? (c.victim_profile || (sharePref.name ? { name: sharePref.name, email: sharePref.email, phone: sharePref.phone } : undefined))
            : undefined,
          latest_checkin: entry,
          latest_source: "questionnaire" as const,
          status: c.status === "resolved" ? "in_support" : c.status,
          signals: Array.from(new Set([
            ...c.signals,
            `Mood: ${entry.moodLabel}`,
            `Sleep: ${entry.sleepHours}h (${entry.sleepQuality})`,
            ...entry.feelings.slice(0, 2),
            "Questionnaire Active",
          ])),
          ml_scores: {
            sentiment_label: computedDistress >= 0.7 ? "HIGH" : computedDistress >= 0.4 ? "MODERATE" : "LOW",
            sentiment_score: Number(computedDistress.toFixed(2)),
            threat_flag: c.ml_scores?.threat_flag || Boolean(entry.reflection && /follow|threat|kill|hurt/i.test(entry.reflection)),
            threat_prob: c.ml_scores?.threat_prob || 0.12,
            voice_stress_score: c.ml_scores?.has_voice_recording ? c.ml_scores.voice_stress_score : undefined,
            voice_label: c.ml_scores?.has_voice_recording ? c.ml_scores.voice_label : undefined,
            has_voice_recording: c.ml_scores?.has_voice_recording || false,
            composite_score: Number(((computedDistress * 0.5) + ((c.ml_scores?.threat_prob || 0.12) * 0.5)).toFixed(2)),
            confidence: 0.88,
            trend_flag: isElevated ? "ESCALATING" : "STABLE",
          },
        };
      }
      return c;
    });
  } else {
    const newCaseId = `case-${Math.floor(1000 + Math.random() * 9000)}`;
    const createdCase: CounsellorCase = {
      id: newCaseId,
      case_id: newCaseId,
      codeword,
      triage_priority: priorityStr,
      status: "new",
      distress_trajectory: [
        { date: "Intake", score: 0.35 },
        { date: "Today " + nowTime, score: Number(computedDistress.toFixed(2)), event: `Questionnaire (${entry.moodLabel})` },
      ],
      fieldNotes: [],
      interaction_history: [qHistoryItem],
      share_personal_info: sharePref.share,
      victim_profile: sharePref.share ? { name: sharePref.name, email: sharePref.email, phone: sharePref.phone } : undefined,
      signals: [
        `Mood: ${entry.moodLabel}`,
        `Sleep: ${entry.sleepHours}h (${entry.sleepQuality})`,
        ...entry.feelings.slice(0, 2),
        "Daily Check-in",
      ],
      summary: summaryText.length > 120 ? summaryText.slice(0, 117) + "..." : summaryText,
      last_interaction: "Just now",
      created_at: new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      latest_checkin: entry,
      latest_source: "questionnaire",
      ml_scores: {
        sentiment_label: computedDistress >= 0.7 ? "HIGH" : computedDistress >= 0.4 ? "MODERATE" : "LOW",
        sentiment_score: Number(computedDistress.toFixed(2)),
        threat_flag: Boolean(entry.reflection && /follow|threat|kill|hurt/i.test(entry.reflection)),
        threat_prob: 0.12,
        has_voice_recording: false,
        composite_score: Number(computedDistress.toFixed(2)),
        confidence: 0.88,
        trend_flag: isElevated ? "ESCALATING" : "STABLE",
      },
    };
    targetCase = createdCase;
    updatedCases = [createdCase, ...cases];
  }

  localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(updatedCases));

  if (isElevated) {
    const alertId = `alt-${Math.floor(1000 + Math.random() * 9000)}`;

    // Extract actual triggering words from Question 4 reflection
    const qTriggerLexicon = [
      "die", "dying", "kill", "killing", "suicide", "hurt", "harm", "end my life", "no reason to live",
      "follow", "following", "threat", "threatened", "threatening", "locked", "weapon", "knife", "gun",
      "destroy", "attack", "panicking", "panic", "scared", "terrified", "frightened", "fear", "worry",
      "cannot take", "can't take", "overwhelmed", "hopeless", "dhamki", "chhod", "bachao", "dar",
      "court", "bail", "accused", "witness", "police", "jail", "intimidation"
    ];
    const reflectionText = (entry.reflection || "").toLowerCase();
    const qTriggerWords: string[] = [];
    for (const term of qTriggerLexicon) {
      if (reflectionText.includes(term)) {
        qTriggerWords.push(term);
      }
    }
    // Also include negative mood / feelings as trigger tokens if none in text
    if (qTriggerWords.length === 0 && (entry.mood <= 2 || entry.sleepHours <= 4)) {
      if (entry.mood <= 2) qTriggerWords.push(`mood_${entry.moodLabel.toLowerCase()}`);
      if (entry.sleepHours <= 4) qTriggerWords.push("severe_sleep_deprivation");
      qTriggerWords.push(...entry.feelings.map((f) => f.toLowerCase()).slice(0, 2));
    }

    const newAlert: TriageAlert = {
      alert_id: alertId,
      case_id: targetCase.case_id,
      thread_id: `thread-${Math.floor(1000 + Math.random() * 9000)}`,
      risk_level: isCritical ? "CRITICAL" : "HIGH",
      composite_score: Number(computedDistress.toFixed(2)),
      confidence: 0.88,
      triage_priority_score: Math.round(computedDistress * 100),
      raised_at: "Just now",
      decision_status: "pending",
      reasons: [
        `📋 Questionnaire Indicator: Victim reported state '${entry.moodLabel}' (Level ${entry.mood}/5)`,
        `Rest telemetry: ${entry.sleepHours}h (${entry.sleepQuality})${entry.sleepHours <= 4 ? " — severe rest deprivation" : ""}`,
        `Feelings flagged: ${entry.feelings.join(", ")}`,
        ...(entry.reflection ? [`Victim reflection: "${entry.reflection.slice(0, 80)}..."`] : []),
      ],
      channel: "questionnaire_checkin",
      victim_text: entry.reflection || `Daily check-in: Mood ${entry.moodLabel} (${entry.mood}/5), Rest: ${entry.sleepHours}h, Feelings: ${entry.feelings.join(", ")}`,
      trigger_words: qTriggerWords,
      victim_info: {
        codeword: targetCase.codeword,
        share_personal_info: !!(targetCase.share_personal_info ?? sharePref.share),
        name: (targetCase.victim_profile?.name || sharePref.name),
        email: (targetCase.victim_profile?.email || sharePref.email),
        latest_mood: entry.moodLabel,
        latest_sleep: `${entry.sleepHours}h (${entry.sleepQuality})`,
        history_count: ((targetCase.interaction_history || []).length) + 1,
      },
      history: [...(targetCase.interaction_history || []), qHistoryItem],
    };
    const existingAlerts = getAlerts();
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify([newAlert, ...existingAlerts]));

    // Generate explainable decision trace for questionnaire alert
    const qTrace: DecisionTrace = {
      thread_id: newAlert.thread_id,
      case_id: targetCase.case_id,
      decision: {
        route: isCritical ? "crisis" : "escalate",
        policy_version: "v2.4.1-safety",
        reasons: newAlert.reasons,
      },
      fusion: {
        confidence: 0.88,
        top_signals: [
          `questionnaire_distress (${(computedDistress * 100).toFixed(0)}%)`,
          `rest_deprivation (${entry.sleepHours}h)`,
          `mood_rating (${entry.mood}/5)`,
        ],
      },
      errors: [],
      victim_text: newAlert.victim_text,
    };
    saveDecisionTrace(qTrace);
  }

  notifyStoreChange();
}

// Sync helper
function syncNewRequestToCases(req: HelpRequest) {
  const cases = getCases();
  const newCase: CounsellorCase = {
    id: req.id,
    case_id: req.id,
    codeword: req.codeword,
    triage_priority: req.supportType === "crisis" ? "P1 - Immediate" : "P2 - Within 2h",
    status: "new",
    distress_trajectory: [
      { date: "Day 1", score: 0.4 },
      { date: "Day 2", score: 0.6 },
      { date: "Today", score: req.supportType === "crisis" ? 0.92 : 0.65, event: "Requested Support" },
    ],
    fieldNotes: [
      {
        id: `fn_init_${Date.now()}`,
        timestamp: "Just now",
        author: "System Intake",
        text: `Confidential intake generated. Preferred contact: ${req.contactMethod}. Type: ${req.supportTypeLabel}.`,
      },
    ],
    signals: [
      req.supportTypeLabel,
      req.contactMethod === "callback" ? "Callback Window" : "In-App Only",
      "Consent active",
    ],
    summary: req.notes || "Victim requested steady human touchpoint through anonymous portal.",
    last_interaction: "Just now",
    created_at: new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
  };
  localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify([newCase, ...cases]));
}

// Initial Seeds for Hackathon Demo
function seedInitialCheckIns(): CheckInEntry[] {
  const today = new Date();
  const entries: CheckInEntry[] = [
    {
      id: "chk-1",
      date: new Date(today.getTime() - 86400000 * 4).toISOString().split("T")[0],
      mood: 2,
      moodLabel: "Heavy",
      sleepHours: 4.5,
      sleepQuality: "Restless",
      feelings: ["heavy", "exhausted", "foggy"],
      reflection: "Everything felt louder than usual. Took a long walk near the trees.",
      createdAt: today.getTime() - 86400000 * 4,
    },
    {
      id: "chk-2",
      date: new Date(today.getTime() - 86400000 * 3).toISOString().split("T")[0],
      mood: 3,
      moodLabel: "Steady",
      sleepHours: 6,
      sleepQuality: "Broken",
      feelings: ["steady", "quiet", "tender"],
      reflection: "Made tea and watched the rain for half an hour.",
      createdAt: today.getTime() - 86400000 * 3,
    },
    {
      id: "chk-3",
      date: new Date(today.getTime() - 86400000 * 2).toISOString().split("T")[0],
      mood: 3,
      moodLabel: "Steady",
      sleepHours: 6.5,
      sleepQuality: "Adequate",
      feelings: ["breathing", "patient"],
      reflection: "Remembered that feelings are weather. They come and pass.",
      createdAt: today.getTime() - 86400000 * 2,
    },
    {
      id: "chk-4",
      date: new Date(today.getTime() - 86400000 * 1).toISOString().split("T")[0],
      mood: 4,
      moodLabel: "Grounded",
      sleepHours: 7,
      sleepQuality: "Restful",
      feelings: ["grounded", "hopeful", "soft"],
      reflection: "Slept through the night without waking in panic.",
      createdAt: today.getTime() - 86400000 * 1,
    },
  ];
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(entries));
  }
  return entries;
}

function seedInitialRequests(): HelpRequest[] {
  const requests: HelpRequest[] = [
    {
      id: "req-1",
      codeword: "quiet-river-17",
      supportType: "emotional",
      supportTypeLabel: "Emotional Grounding",
      contactMethod: "in_app",
      consentScopes: {
        chatAnalysis: true,
        voiceSignals: false,
        emailCheckin: false,
        smsCheckin: false,
        escalationLadder: true,
      },
      status: "in_support",
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      assignedCounsellor: "Dr. Ananya Roy",
    },
    {
      id: "req-2",
      codeword: "amber-meadow-42",
      supportType: "domestic",
      supportTypeLabel: "Confidential Safety Support",
      contactMethod: "callback",
      callbackWindow: "Evening 7:00 PM - 8:30 PM",
      notes: "Please do not mention Sahaara if someone else answers.",
      consentScopes: {
        chatAnalysis: true,
        voiceSignals: false,
        emailCheckin: false,
        smsCheckin: false,
        escalationLadder: true,
      },
      status: "contacted",
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      assignedCounsellor: "M. Fernandes",
    },
  ];
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
  }
  return requests;
}

function seedInitialAlerts(): TriageAlert[] {
  const alerts: TriageAlert[] = [
    {
      alert_id: "alt-9041",
      case_id: "case-9412",
      thread_id: "thread-8492",
      risk_level: "CRITICAL",
      composite_score: 0.94,
      confidence: 0.91,
      triage_priority_score: 98,
      raised_at: "14 mins ago",
      decision_status: "pending",
      reasons: ["Critical distress spike", "Explicit suicidal ideation phrasing detected"],
      channel: "pwa_chat",
      victim_text: "I don't think I can make it through tonight. Please help me before I do something to myself.",
      victim_info: {
        codeword: "quiet-river-17",
        share_personal_info: true,
        name: "Maya S.",
        email: "maya.s@proton.me",
        latest_mood: "Fragile (1/5)",
        latest_sleep: "3.5h (Restless)",
        history_count: 3,
      },
      history: [
        {
          id: "vh_9041_1",
          timestamp: "Sep 7 19:40",
          text: "I am feeling so trapped, the shouting started again.",
          source: "chat",
          risk_level: "HIGH",
          details: "MuRIL: HIGH (88%)",
        },
        {
          id: "vh_9041_2",
          timestamp: "Sep 7 21:10",
          text: "Felt Fragile (1/5) · Rest: 3.5h (Restless) · Feelings: overwhelmed, terrified",
          source: "questionnaire",
          risk_level: "HIGH",
        },
        {
          id: "vh_9041_3",
          timestamp: "Sep 7 21:14",
          text: "I don't think I can make it through tonight. Please help me before I do something to myself.",
          source: "chat",
          risk_level: "CRITICAL",
          details: "Explicit crisis phrasing detected",
        },
      ],
    },
    {
      alert_id: "alt-8812",
      case_id: "case-8820",
      thread_id: "thread-6218",
      risk_level: "HIGH",
      composite_score: 0.78,
      confidence: 0.86,
      triage_priority_score: 82,
      raised_at: "48 mins ago",
      decision_status: "pending",
      reasons: ["Multiple missed check-in windows", "Escalation ladder step 2 reached"],
      channel: "checkin_ladder",
      victim_text: "Feeling so isolated and scared to step out of the house. Need a quiet callback.",
      victim_info: {
        codeword: "amber-meadow-42",
        share_personal_info: false,
        latest_mood: "Heavy (2/5)",
        latest_sleep: "4.5h (Broken)",
        history_count: 2,
      },
      history: [
        {
          id: "vh_8812_1",
          timestamp: "Sep 8 09:20",
          text: "Felt Heavy (2/5) · Rest: 4.5h · Missed morning safety ping",
          source: "questionnaire",
          risk_level: "HIGH",
        },
        {
          id: "vh_8812_2",
          timestamp: "Sep 8 10:12",
          text: "Feeling so isolated and scared to step out of the house. Need a quiet callback.",
          source: "chat",
          risk_level: "HIGH",
          details: "Safe window requested 7 PM",
        },
      ],
    },
    {
      alert_id: "alt-7193",
      case_id: "case-7731",
      thread_id: "thread-3301",
      risk_level: "MODERATE",
      composite_score: 0.58,
      confidence: 0.79,
      triage_priority_score: 61,
      raised_at: "2 hours ago",
      decision_status: "approved",
      counsellor_note: "Assigned to peer listener follow-up",
      reasons: ["Sleep deficit 4 consecutive days", "Gentle check-in recommended"],
      channel: "daily_checkin",
      victim_text: "Unable to sleep more than 3 hours every night. Head hurts constantly.",
      victim_info: {
        codeword: "misty-cedar-88",
        share_personal_info: false,
        latest_mood: "Steady (3/5)",
        latest_sleep: "3.0h (Broken)",
        history_count: 1,
      },
      history: [
        {
          id: "vh_7193_1",
          timestamp: "Sep 7 12:05",
          text: "Unable to sleep more than 3 hours every night. Head hurts constantly.",
          source: "chat",
          risk_level: "MODERATE",
        },
      ],
    },
  ];
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts));
  }
  return alerts;
}

function seedInitialCases(): CounsellorCase[] {
  const cases: CounsellorCase[] = [
    {
      id: "case-9412",
      case_id: "case-9412",
      codeword: "quiet-river-17",
      is_seed: true,
      triage_priority: "P1 - Immediate",
      status: "in_support",
      share_personal_info: true,
      victim_profile: {
        name: "Maya S.",
        email: "maya.s@proton.me",
        phone: "+91 98765 43210",
      },
      interaction_history: [
        {
          id: "ih-1",
          timestamp: "Sep 6, 14:20",
          text: "Felt Fragile (1/5) · Rest: 4h · Feelings: exhausted, isolated, scared",
          source: "questionnaire",
          risk_level: "HIGH",
        },
        {
          id: "ih-2",
          timestamp: "Sep 7, 19:40",
          text: "I am feeling so trapped, the shouting started again and they took the room keys.",
          source: "chat",
          risk_level: "HIGH",
          details: "MuRIL: HIGH (88%)",
        },
        {
          id: "ih-3",
          timestamp: "Sep 7, 21:14",
          text: "I don't think I can make it through tonight. Please help me before I do something to myself.",
          source: "chat",
          risk_level: "CRITICAL",
          details: "Crisis trigger overrides engaged",
        },
        {
          id: "ih-4",
          timestamp: "Sep 8, 18:35",
          text: "The breathing anchor helped steady my chest. Still frightened but grounded.",
          source: "chat",
          risk_level: "MODERATE",
        },
      ],
      distress_trajectory: [
        { date: "Sep 4", score: 0.35 },
        { date: "Sep 5", score: 0.42 },
        { date: "Sep 6", score: 0.58 },
        { date: "Sep 7", score: 0.85, event: "Crisis escalation" },
        { date: "Sep 8", score: 0.72, event: "Grounding session" },
        { date: "Today", score: 0.54, event: "De-escalating" },
      ],
      fieldNotes: [
        {
          id: "fn-1",
          timestamp: "Sep 8, 18:30",
          author: "Dr. Ananya Roy",
          text: "Held 20 min grounding over safe channel. Victim reported sensory anchors helped reduce racing thoughts.",
        },
        {
          id: "fn-2",
          timestamp: "Sep 7, 21:15",
          author: "M. Fernandes",
          text: "Initial triage approved after critical alert. Safety protocol confirmed.",
        },
      ],
      signals: ["Distress slope +0.48", "Sleep < 4h", "Consent active"],
      summary: "Undergoing guided unburdening. Receptive to grounding exercises; monitoring sleep recovery.",
      last_interaction: "35 mins ago",
      created_at: "Sep 4",
      ml_scores: {
        sentiment_label: "HIGH",
        sentiment_score: 0.87,
        threat_flag: true,
        threat_prob: 0.92,
        voice_stress_score: 0.81,
        voice_label: "STRESSED",
        composite_score: 0.87,
        confidence: 0.91,
        trend_flag: "ESCALATING",
      },
    },
    {
      id: "case-8820",
      case_id: "case-8820",
      codeword: "amber-meadow-42",
      is_seed: true,
      triage_priority: "P2 - Within 2h",
      status: "contacted",
      distress_trajectory: [
        { date: "Sep 6", score: 0.52 },
        { date: "Sep 7", score: 0.65 },
        { date: "Sep 8", score: 0.74, event: "Requested callback" },
        { date: "Today", score: 0.68 },
      ],
      fieldNotes: [
        {
          id: "fn-3",
          timestamp: "Today, 10:15",
          author: "Dr. Ananya Roy",
          text: "Scheduled callback in requested evening window (7 PM). Pre-briefed domestic safety directory.",
        },
      ],
      signals: ["Domestic safety request", "Callback window set", "Strict discreet mode"],
      summary: "Discreet callback requested. Safe window established for 7:00 PM.",
      last_interaction: "1 hour ago",
      created_at: "Sep 6",
      ml_scores: {
        sentiment_label: "MODERATE",
        sentiment_score: 0.61,
        threat_flag: false,
        threat_prob: 0.38,
        voice_stress_score: 0.55,
        voice_label: "STRESSED",
        composite_score: 0.52,
        confidence: 0.86,
        trend_flag: "STABLE",
      },
    },
    {
      id: "case-7731",
      case_id: "case-7731",
      codeword: "misty-cedar-88",
      is_seed: true,
      triage_priority: "P3 - Routine",
      status: "resolved",
      distress_trajectory: [
        { date: "Sep 1", score: 0.6 },
        { date: "Sep 3", score: 0.45 },
        { date: "Sep 5", score: 0.3 },
        { date: "Sep 7", score: 0.22, event: "Completed grounding cycle" },
      ],
      fieldNotes: [
        {
          id: "fn-4",
          timestamp: "Sep 7, 14:00",
          author: "Dr. Ananya Roy",
          text: "Successfully stabilized. Check-ins steady for 5 consecutive days. Case closed with open unburdening door.",
        },
      ],
      signals: ["Stable 5+ days", "Sleep 7h+", "Routine closed"],
      summary: "Successfully stabilized. Returning to self-guided check-ins.",
      last_interaction: "2 days ago",
      created_at: "Sep 1",
      ml_scores: {
        sentiment_label: "LOW",
        sentiment_score: 0.18,
        threat_flag: false,
        threat_prob: 0.04,
        voice_stress_score: 0.21,
        voice_label: "NOT_STRESSED",
        composite_score: 0.19,
        confidence: 0.94,
        trend_flag: "STABLE",
      },
    },

  ];
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(cases));
  }
  return cases;
}
