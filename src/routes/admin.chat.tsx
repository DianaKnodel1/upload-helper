import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/chat")({
  component: AdminChatPage,
});

import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useChatNotifications } from "@/hooks/use-chat-notifications";
import { Send, Bot, UserCheck, Search, MessageCircle, Building2, EyeOff, Archive, ChevronRight, MailOpen, StickyNote, AlertCircle, Lock, Pencil, Trash2, Check, X, Mail, Sparkles, Loader2, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLastSignIns } from "@/lib/last-sign-ins.functions";
import { replaceMessages, type ChatConnectionState } from "@/lib/chat-sync";
import { fetchAll } from "@/lib/fetch-all";
import { useOnlineUsers } from "@/hooks/use-presence";
import { useSearchParams } from "@/lib/router-compat";
import { useNavigate } from "@/lib/router-compat";
import { EmojiPicker } from "@/components/EmojiPicker";
import { ChatAttachmentButton, AttachmentPreview, type ChatAttachment } from "@/components/ChatAttachmentButton";
import { useServerFn } from "@tanstack/react-start";
import { getAiSuggestion, logAiCorrection } from "@/lib/ai-chat-helper.functions";
import { setEmployeeBlocked } from "@/lib/employee-block.functions";

interface Conversation {
  user_id: string;
  full_name: string;
  status: string;
  escalated_at: string | null;
  unread: number;
  lastMessage?: string;
  lastAt?: string;
  lastSignInAt?: string | null;
  lastSeenAt?: string | null;
  tenantName?: string | null;
  tenantId?: string | null;
  adminUnread?: boolean;
  adminNote?: string | null;
  lastFromEmployeeAt?: string | null;
  hiddenAt?: string | null;
  blocked?: boolean;
}

const UNANSWERED_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4h
const isUnanswered = (c: Conversation) =>
  !!c.lastFromEmployeeAt &&
  Date.now() - new Date(c.lastFromEmployeeAt).getTime() > UNANSWERED_THRESHOLD_MS;

// Interne KI-/Eskalations-Notizen: clientseitig filtern, damit keine normale
// Nachricht durch serverseitige Textfilter verloren geht.
const HISTORY_PAGE_SIZE = 200;
function isInternalAdminNote(message: string | null | undefined) {
  const m = message ?? "";
  return (
    m.startsWith("[ESCALATE]") ||
    m.startsWith("🤖 KI-Eskalation") ||
    m.startsWith("🤖 KI Eskalation")
  );
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  read: boolean;
  created_at: string;
  is_ai?: boolean;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  delivery_status?: "sending" | "failed";
}

function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    if (!isInternalAdminNote(message.message)) byId.set(message.id, message);
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

function AdminChatPage() {
  const { user } = useAuth();
  const onlineUsers = useOnlineUsers();
  // Eigener Teamleiter-Status: steuert, was Mitarbeiter im Chat lesen.
  const [leaderOnline, setLeaderOnline] = useState(true);
  const [savingPresence, setSavingPresence] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);
  const aiSuggestionFn = useServerFn(getAiSuggestion);
  const logCorrectionFn = useServerFn(logAiCorrection);
  // Letzter KI-Vorschlag – dient dem stillen Nachlernen beim Senden.
  const lastSuggestionRef = useRef<string>("");
  // Steht im Eingabefeld gerade ein (noch nicht bearbeiteter) Vorschlag?
  const [suggestionActive, setSuggestionActive] = useState(false);
  // Pro Unterhaltung merken, für welche eingegangene Nachricht schon automatisch
  // ein Vorschlag erzeugt wurde – verhindert unnötige Anfragen.
  const autoSuggestedRef = useRef<Map<string, string>>(new Map());

  const [filterTab] = useState<"all" | "escalated" | "open">("all");
  const [viewTab, setViewTab] = useState<"active" | "hidden">("active");
  const [tenantFilter, setTenantFilter] = useState<string>("all"); // tenant_id oder "all"
  const [hiding, setHiding] = useState(false);
  // Mehrfachauswahl in der Chat-Liste (z. B. mehrere Chats gleichzeitig ausblenden)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  // Live-Verbindung des Chats (Realtime) – für die Anzeige im Chatkopf.
  const [connState, setConnState] = useState<ChatConnectionState>("live");
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedUserIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  // Verlauf: neueste Seite zuerst, ältere auf Wunsch nachladen.
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // user_id -> team_leader_id (für Antworten im Namen des Teamleiters)
  const leaderMapRef = useRef<Map<string, string | null>>(new Map());
  // Alle Admin-/Staff-Konten (Gegenseite im Chat)
  const adminIdsRef = useRef<Set<string>>(new Set());

  // Browser-Notification + Sound + Tab-Title-Blink
  const totalUnread = useMemo(
    () => conversations.reduce((s, c) => s + (c.unread || 0), 0),
    [conversations]
  );
  const { trigger: notifyChat, requestPermission } = useChatNotifications({
    unread: totalUnread,
    enabled: true,
  });
  useEffect(() => { requestPermission(); }, [requestPermission]);

  // Optional: ?user=<id> aus URL übernehmen (Deep-Link aus Mitarbeiter-Detail)
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const u = searchParams.get("user");
    if (u) setSelectedUserId(u);
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user]);

  useEffect(() => { selectedUserIdRef.current = selectedUserId; }, [selectedUserId]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // "Zuletzt aktiv" aktuell halten: Werte alle 60s neu laden (nur bei
  // sichtbarem Tab) sowie sofort bei Fokus/Sichtbarwechsel. Zusätzlich ein
  // Tick, damit die relative Textanzeige ("Aktiv vor X Min") mitläuft.
  const [, setActivityTick] = useState(0);
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    const run = () => {
      setActivityTick((t) => t + 1);
      if (document.visibilityState === "visible") void refreshActivity();
    };
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    const iv = window.setInterval(run, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [user]);


  const loadConversations = async () => {
    // Wichtig: profiles/chat_conversations seitenweise laden. Ohne Pagination
    // liefert die Data-API nur 1000 Zeilen – ab dem 1001. Mitarbeiter wären
    // dessen Chats komplett unsichtbar (Profil fehlt → Chat wird gefiltert).
    const [profilesRes, convsRes, aggRes, msgsRes, tenantsRes, rolesRes] = await Promise.all([
      fetchAll<any>(() => supabase.from("profiles").select("user_id, full_name, tenant_id, team_leader_id, is_blocked").order("user_id"))
        .then((data) => ({ data }))
        .catch(() => ({ data: [] as any[] })),
      fetchAll<any>(() => supabase.from("chat_conversations").select("user_id, status, escalated_at, admin_hidden_at, admin_unread, admin_note").order("user_id"))
        .then((data) => ({ data }))
        .catch(() => ({ data: [] as any[] })),
      // Serverseitige Aggregation über ALLE Nachrichten (kein Fenster-Limit).
      (supabase as any).rpc("list_chat_conversations"),
      // Rückfall, solange die SQL-Funktion auf der Datenbank noch fehlt.
      // Auch hier seitenweise, weil .limit(5000) von der API auf 1000 gekappt wird.
      (async () => {
        const rows: any[] = [];
        for (let from = 0; from < 5000; from += 1000) {
          const { data } = await supabase
            .from("chat_messages")
            .select("sender_id, receiver_id, message, read, created_at")
            .order("created_at", { ascending: false })
            .range(from, from + 999);
          const chunk = (data ?? []) as any[];
          rows.push(...chunk);
          if (chunk.length < 1000) break;
        }
        return { data: rows };
      })(),
      supabase.from("tenants").select("id, name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const profiles = profilesRes.data ?? [];
    if (!profiles.length) { setLoading(false); return; }
    const adminIds = new Set<string>(
      ((rolesRes.data ?? []) as any[])
        .filter((r) => r.role === "admin" || r.role === "admin_mitarbeiter")
        .map((r) => r.user_id as string)
    );
    adminIds.add(user!.id);
    adminIdsRef.current = adminIds;
    leaderMapRef.current = new Map(
      (profiles as any[]).map((p) => [p.user_id as string, (p.team_leader_id as string | null) ?? null])
    );
    const tenantMap = new Map<string, string>(((tenantsRes.data ?? []) as any[]).map((t) => [t.id, t.name]));
    const profileMap = new Map(profiles.map((p: any) => [p.user_id, { name: p.full_name as string, tenant_id: p.tenant_id as string | null, blocked: !!p.is_blocked }]));
    const convMap = new Map<string, any>((convsRes.data ?? []).map((c: any) => [c.user_id, c]));

    type Agg = { lastMessage: string; lastAt: string; unread: number; lastFromEmployeeAt: string | null };
    const agg = new Map<string, Agg>();

    const aggRows = (aggRes as any)?.error ? null : ((aggRes as any)?.data as any[] | null);
    if (aggRows && aggRows.length) {
      for (const r of aggRows) {
        if (!r.partner_id || !profileMap.has(r.partner_id)) continue;
        agg.set(r.partner_id, {
          lastMessage: r.last_message ?? "",
          lastAt: r.last_at,
          unread: Number(r.unread ?? 0),
          lastFromEmployeeAt: r.last_from_partner_at ?? null,
        });
      }
    } else {
      // msgs are ordered DESC → first entry per partner is the newest
      for (const m of (msgsRes.data ?? []) as any[]) {
        if (isInternalAdminNote(m.message)) continue;
        // Gegenüber = die Seite, die kein Admin-/Staff-Konto ist
        const partnerId = adminIds.has(m.sender_id) ? m.receiver_id : m.sender_id;
        if (!partnerId || adminIds.has(partnerId)) continue;
        if (!profileMap.has(partnerId)) continue;
        let entry = agg.get(partnerId);
        if (!entry) {
          entry = {
            lastMessage: m.message,
            lastAt: m.created_at,
            unread: 0,
            lastFromEmployeeAt: m.sender_id === partnerId ? m.created_at : null,
          };
          agg.set(partnerId, entry);
        }
        if (m.sender_id === partnerId && !m.read) entry.unread += 1;
      }
    }

    const list: Conversation[] = [];
    for (const [partnerId, a] of agg) {
      const conv = convMap.get(partnerId);
      const prof = profileMap.get(partnerId);
      list.push({
        user_id: partnerId,
        full_name: prof?.name ?? "Mitarbeiter",
        status: conv?.status ?? "direct",
        escalated_at: conv?.escalated_at ?? null,
        unread: a.unread,
        lastMessage: a.lastMessage,
        lastAt: a.lastAt,
        tenantId: prof?.tenant_id ?? null,
        tenantName: prof?.tenant_id ? tenantMap.get(prof.tenant_id) ?? null : null,
        adminUnread: !!conv?.admin_unread,
        adminNote: conv?.admin_note ?? null,
        lastFromEmployeeAt: a.lastFromEmployeeAt,
        hiddenAt: conv?.admin_hidden_at ?? null,
        blocked: !!prof?.blocked,
      });
    }

    list.sort((a, b) => {
      if (a.status === "escalated" && b.status !== "escalated") return -1;
      if (a.status !== "escalated" && b.status === "escalated") return 1;
      const aFlag = a.unread || a.adminUnread ? 1 : 0;
      const bFlag = b.unread || b.adminUnread ? 1 : 0;
      if (aFlag !== bFlag) return bFlag - aFlag;
      return (b.lastAt ?? "").localeCompare(a.lastAt ?? "");
    });

    setConversations(list);
    setLoading(false);

    if (list.length > 0) await refreshActivity(list.map((c) => c.user_id));
  };

  /**
   * Lädt die Aktivitätsdaten (Heartbeat + letzter Login) nach.
   * Wird beim Laden der Liste UND regelmäßig aufgerufen, damit
   * "Zuletzt aktiv" in einem lange geöffneten Postfach nicht einfriert.
   */
  const refreshActivity = async (userIds?: string[]) => {
    const ids = userIds ?? conversationsRef.current.map((c) => c.user_id);
    if (ids.length === 0) return;
    try {
      const res = await getLastSignIns({ data: { user_ids: ids } });
      const map = res.activity ?? {};
      const problems = [res.signInError, res.seenError].filter(Boolean) as string[];
      // Die Anzeige "Zuletzt aktiv" basiert ausschließlich auf dem Heartbeat
      // (last_seen_at). Fällt diese Quelle aus, ist die Anzeige nicht belastbar.
      setActivityError(res.seenError ?? null);
      if (problems.length > 0) console.warn("Aktivitäts-Quellen teilweise nicht verfügbar:", problems);
      setConversations((prev) => prev.map((c) => ({
        ...c,
        lastSignInAt: map[c.user_id]?.last_sign_in_at ?? c.lastSignInAt ?? null,
        lastSeenAt: map[c.user_id]?.last_seen_at ?? c.lastSeenAt ?? null,
      })));
    } catch (e: any) {
      const msg = e?.message || String(e);
      setActivityError(msg);
      console.warn("Aktivitätsdaten konnten nicht geladen werden:", e);
    }
  };

  const formatLastActive = (ts?: string | null) => {
    if (!ts) return activityError ? "Status unbekannt" : "Keine Aktivität";
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 2) return "Gerade aktiv";
    if (m < 60) return `Aktiv vor ${m} Min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Aktiv vor ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `Aktiv vor ${d} Tagen`;
    return `Aktiv am ${new Date(ts).toLocaleDateString("de-DE")}`;
  };

  /**
   * "Zuletzt aktiv" = echte Portal-Aktivität (Heartbeat).
   * Letzter Login und letzte Nachricht sind bewusst KEINE Aktivitätsquellen
   * mehr – sie stehen nur noch als Zusatzinfo im Tooltip.
   */
  const activityAt = (conv: Conversation) => conv.lastSeenAt ?? null;

  const activityTooltip = (conv: Conversation) => {
    const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString("de-DE") : "—");
    return [
      `Zuletzt im Portal: ${fmt(conv.lastSeenAt)}`,
      `Letzter Login: ${fmt(conv.lastSignInAt)}`,
      `Letzte Nachricht: ${fmt(conv.lastFromEmployeeAt)}`,
    ].join("\n");
  };



  const selectConversation = async (userId: string) => {
    setSelectedUserId(userId);
    setHistoryError(null);
    setHasMore(false);
    // Immer die NEUESTEN Nachrichten laden (absteigend) und für die Anzeige umdrehen.
    const { data: msgs, error: msgErr } = await supabase
      .from("chat_messages").select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(HISTORY_PAGE_SIZE);
    if (msgErr) {
      // Verlauf nicht leeren – sonst verschwinden sichtbare Nachrichten.
      setHistoryError("Verlauf konnte nicht geladen werden – bitte erneut versuchen.");
    } else {
      const rows = ((msgs ?? []) as ChatMessage[]).slice().reverse();
      setHasMore(rows.length >= HISTORY_PAGE_SIZE);
      // Ersetzt den Verlauf, behält aber lokal noch nicht gesendete Nachrichten.
      setMessages((prev) => replaceMessages(
        prev.filter((m) => m.sender_id === userId || m.receiver_id === userId),
        rows.filter((m) => !isInternalAdminNote(m.message)),
      ));
    }



    await supabase
      .from("chat_messages").update({ read: true } as any)
      .eq("sender_id", userId).eq("read", false);

    // Beim Öffnen: ungelesen-Flag zurücksetzen.
    // status mitschreiben, sonst würde ein neu angelegter Datensatz auf den
    // Standardwert "ai" fallen und plötzlich die KI statt des Admins antworten.
    await supabase
      .from("chat_conversations")
      .upsert({
        user_id: userId,
        status: conversationsRef.current.find((c) => c.user_id === userId)?.status ?? "direct",
        admin_unread: false,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "user_id" });

    setConversations((prev) => prev.map((c) => c.user_id === userId ? { ...c, unread: 0, adminUnread: false } : c));
    setNoteDraft(conversations.find((c) => c.user_id === userId)?.adminNote ?? "");
  };

  /** Lädt die nächste Seite älterer Nachrichten vor die aktuell angezeigten. */
  const loadOlderMessages = async () => {
    if (!selectedUserId || loadingOlder) return;
    const oldest = messages[0]?.created_at;
    if (!oldest) return;
    setLoadingOlder(true);
    const { data, error } = await supabase
      .from("chat_messages").select("*")
      .or(`sender_id.eq.${selectedUserId},receiver_id.eq.${selectedUserId}`)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(HISTORY_PAGE_SIZE);
    if (error) {
      setHistoryError("Ältere Nachrichten konnten nicht geladen werden.");
    } else {
      const rows = ((data ?? []) as ChatMessage[]).slice().reverse();
      setHasMore(rows.length >= HISTORY_PAGE_SIZE);
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [...rows.filter((m) => !known.has(m.id) && !isInternalAdminNote(m.message)), ...prev];
      });
    }
    setLoadingOlder(false);
  };



  const toggleBlockedInChat = async (userId: string, blocked: boolean) => {
    try {
      await setEmployeeBlocked({ data: { user_id: userId, blocked } });
      setConversations((prev) => prev.map((c) => (c.user_id === userId ? { ...c, blocked } : c)));
      toast({ title: blocked ? "Mitarbeiter gesperrt" : "Mitarbeiter freigegeben" });
    } catch (e: any) {
      toast({ title: "Fehler", description: e?.message ?? "Aktion fehlgeschlagen", variant: "destructive" });
    }
  };

  const markUnread = async (userId: string) => {
    const { error } = await supabase
      .from("chat_conversations")
      .upsert({
        user_id: userId,
        status: conversationsRef.current.find((c) => c.user_id === userId)?.status ?? "direct",
        admin_unread: true,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "user_id" });
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    setConversations((prev) => prev.map((c) => c.user_id === userId ? { ...c, adminUnread: true } : c));
    if (selectedUserId === userId) setSelectedUserId(null);
    toast({ title: "Als ungelesen markiert" });
  };

  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const saveNote = async (userId: string) => {
    setSavingNote(true);
    const value = noteDraft.trim() || null;
    const { error } = await supabase
      .from("chat_conversations")
      .upsert({
        user_id: userId,
        status: conversationsRef.current.find((c) => c.user_id === userId)?.status ?? "direct",
        admin_note: value,
        admin_note_updated_at: new Date().toISOString(),
        admin_note_updated_by: user!.id,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "user_id" });
    setSavingNote(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    setConversations((prev) => prev.map((c) => c.user_id === userId ? { ...c, adminNote: value } : c));
    toast({ title: "Notiz gespeichert" });
  };


  const takeOver = async (userId: string) => {
    await supabase
      .from("chat_conversations")
      .update({ status: "human", updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    setConversations((prev) => prev.map((c) => c.user_id === userId ? { ...c, status: "human" } : c));
    toast({ title: "Chat übernommen" });
  };

  


  /**
   * Baut eine Upsert-Zeile für chat_conversations.
   * Wichtig: Der bekannte Status wird mitgeschrieben, damit ein neu angelegter
   * Datensatz nicht auf den Standardwert "ai" fällt (sonst würde plötzlich die
   * KI statt eines Admins antworten).
   */
  const conversationRow = (userId: string, hiddenAt: string | null, now: string) => {
    const conv = conversationsRef.current.find((c) => c.user_id === userId);
    return {
      user_id: userId,
      status: conv?.status ?? "direct",
      admin_hidden_at: hiddenAt,
      updated_at: now,
    };
  };

  const hideConversation = async (userId: string) => {
    setHiding(true);
    const hiddenAt = new Date().toISOString();
    const { error } = await supabase
      .from("chat_conversations")
      .upsert(conversationRow(userId, hiddenAt, hiddenAt) as any, { onConflict: "user_id" });
    setHiding(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    setConversations((prev) => prev.map((c) => c.user_id === userId ? { ...c, hiddenAt } : c));
    if (selectedUserId === userId) setSelectedUserId(null);
    toast({ title: "Chat archiviert", description: "Im Tab 'Archiv' weiter sichtbar." });
  };

  const unhideConversation = async (userId: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("chat_conversations")
      .upsert(conversationRow(userId, null, now) as any, { onConflict: "user_id" });
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    setConversations((prev) => prev.map((c) => c.user_id === userId ? { ...c, hiddenAt: null } : c));
    toast({ title: "Chat wiederhergestellt" });
  };

  // ---- Mehrfachauswahl ----
  const toggleSelectOne = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const bulkSetHidden = async (hide: boolean) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    const now = new Date().toISOString();
    const ids = Array.from(selectedIds);
    const rows = ids.map((uid) => conversationRow(uid, hide ? now : null, now));
    const { error } = await supabase
      .from("chat_conversations")
      .upsert(rows as any, { onConflict: "user_id" });
    setBulkBusy(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    setConversations((prev) => prev.map((c) => selectedIds.has(c.user_id) ? { ...c, hiddenAt: hide ? now : null } : c));
    if (hide && selectedUserId && selectedIds.has(selectedUserId)) setSelectedUserId(null);
    toast({ title: hide ? `${ids.length} Chat(s) archiviert` : `${ids.length} Chat(s) wiederhergestellt` });
    exitSelectMode();
  };



  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const startEdit = (msg: ChatMessage) => {
    setEditingId(msg.id);
    setEditDraft(msg.message);
  };
  const cancelEdit = () => { setEditingId(null); setEditDraft(""); };
  const saveEdit = async (msg: ChatMessage) => {
    const next = editDraft.trim();
    if (!next || next === msg.message) { cancelEdit(); return; }
    const { error } = await supabase
      .from("chat_messages")
      .update({ message: next, edited_at: new Date().toISOString() } as any)
      .eq("id", msg.id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, message: next } : m));
    cancelEdit();
  };
  const deleteMessage = async (msg: ChatMessage) => {
    if (!confirm("Nachricht wirklich löschen?")) return;
    const { error } = await supabase.from("chat_messages").delete().eq("id", msg.id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
  };

  const generateSuggestion = async (opts?: { silent?: boolean }) => {
    if (!selectedUserId || generatingAi) return;
    setGeneratingAi(true);
    try {
      const lastMsg = messages.filter(m => m.sender_id === selectedUserId).pop()?.message || "";
      const conv = conversations.find(c => c.user_id === selectedUserId);
      const teamLeaderName = user?.user_metadata?.full_name || conv?.tenantName || "Teamleiter";

      const context = messages.slice(-8).map(m => ({
        role: adminIdsRef.current.has(m.sender_id) ? "assistant" : "user" as "assistant" | "user",
        content: m.message
      }));

      const res = await aiSuggestionFn({
        data: {
          userId: selectedUserId,
          lastMessage: lastMsg,
          context,
          teamLeaderName
        }
      });
      if (res.suggestion) {
        lastSuggestionRef.current = res.suggestion;
        setNewMessage(res.suggestion);
        setSuggestionActive(true);
      } else if (!opts?.silent) {
        toast({ title: "KI", description: (res as any).error ?? "Kein Vorschlag erhalten.", variant: "destructive" });
      }
    } catch (e: any) {
      if (!opts?.silent) {
        toast({ title: "KI Fehler", description: e.message || "Vorschlag konnte nicht generiert werden.", variant: "destructive" });
      }
    } finally {
      setGeneratingAi(false);
    }
  };

  const discardSuggestion = () => {
    lastSuggestionRef.current = "";
    setSuggestionActive(false);
    setNewMessage("");
    broadcastTyping("");
  };

  // Automatischer Vorschlag: sobald eine Unterhaltung geöffnet wird und die
  // letzte Nachricht vom Mitarbeiter stammt, steht der Entwurf sofort bereit.
  // Gesendet wird nichts – der Text muss immer freigegeben werden.
  useEffect(() => {
    if (!selectedUserId || generatingAi || sending) return;
    if (newMessage.trim() || pendingAttachment) return;
    const last = messages[messages.length - 1];
    if (!last || last.sender_id !== selectedUserId) return;
    if (autoSuggestedRef.current.get(selectedUserId) === last.id) return;
    autoSuggestedRef.current.set(selectedUserId, last.id);
    void generateSuggestion({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, messages]);


  const persistMessage = async (
    optimisticId: string,
    recipientId: string,
    text: string,
    attachment: ChatAttachment | null,
    shouldLogCorrection: boolean,
  ) => {
    if (!user) return;
    setSending(true);
    const { data: inserted, error } = await supabase.from("chat_messages").insert({
      sender_id: user.id,
      receiver_id: recipientId,
      message: text || (attachment ? `📎 ${attachment.name}` : ""),
      attachment_url: attachment?.url ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_type: attachment?.type ?? null,
    } as any).select("*").single();
    if (error || !inserted) {
      setMessages((prev) => prev.map((message) =>
        message.id === optimisticId ? { ...message, delivery_status: "failed" } : message
      ));
      toast({
        title: "Nachricht nicht gesendet",
        description: error?.message ?? "Bitte versuche es erneut.",
        variant: "destructive",
      });
      setSending(false);
      return;
    }
    setMessages((prev) => mergeChatMessages(
      prev.filter((message) => message.id !== optimisticId),
      [inserted as ChatMessage],
    ));
    setConversations((prev) => prev.map((conversation) =>
      conversation.user_id === recipientId
        ? { ...conversation, lastMessage: inserted.message, lastAt: inserted.created_at, lastFromEmployeeAt: null }
        : conversation
    ));
    // Still lernen: Abweichung zwischen Vorschlag und tatsächlich Gesendetem merken.
    if (shouldLogCorrection && lastSuggestionRef.current) {
      const suggestion = lastSuggestionRef.current;
      lastSuggestionRef.current = "";
      void logCorrectionFn({ data: { targetUserId: recipientId, suggestion, finalText: text } }).catch(() => {});
    }
    setSending(false);
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !pendingAttachment) || !selectedUserId || !user) return;
    const text = newMessage.trim();
    const attachment = pendingAttachment;
    const recipientId = selectedUserId;
    const optimisticId = `pending-${crypto.randomUUID()}`;
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      sender_id: user.id,
      receiver_id: recipientId,
      message: text || (attachment ? `📎 ${attachment.name}` : ""),
      read: false,
      created_at: new Date().toISOString(),
      attachment_url: attachment?.url ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_type: attachment?.type ?? null,
      delivery_status: "sending",
    };
    setMessages((prev) => mergeChatMessages(prev, [optimisticMessage]));
    setNewMessage("");
    broadcastTyping("");
    setSuggestionActive(false);
    setPendingAttachment(null);
    await persistMessage(optimisticId, recipientId, text, attachment, true);
  };

  const retryMessage = async (message: ChatMessage) => {
    if (!user || message.delivery_status !== "failed") return;
    setMessages((prev) => prev.map((item) =>
      item.id === message.id ? { ...item, delivery_status: "sending" } : item
    ));
    const attachment = message.attachment_url ? {
      url: message.attachment_url,
      name: message.attachment_name ?? "Anhang",
      type: message.attachment_type ?? "application/octet-stream",
    } : null;
    await persistMessage(message.id, message.receiver_id, message.message, attachment, false);
  };

  // Realtime
  useEffect(() => {
    if (!user) return;
    const syncActiveConversation = async () => {
      const activeUserId = selectedUserIdRef.current;
      if (!activeUserId) return;
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .or(`sender_id.eq.${activeUserId},receiver_id.eq.${activeUserId}`)
        .order("created_at", { ascending: false })
        .limit(HISTORY_PAGE_SIZE);
      if (!error && data) {
        setMessages((prev) => mergeChatMessages(prev, (data as ChatMessage[]).slice().reverse()));
      }
    };
    const channel = supabase
      .channel("admin-chat-unified")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, async (payload) => {
        const msg = payload.new as ChatMessage;
        const adminIds = adminIdsRef.current;
        const partner = adminIds.has(msg.sender_id) ? msg.receiver_id : msg.sender_id;
        if (!partner || adminIds.has(partner)) return;

        // Nachricht zum offenen Chat hinzufügen
        const activeUserId = selectedUserIdRef.current;
        if (activeUserId && partner === activeUserId) {
          setMessages((prev) => mergeChatMessages(prev, [msg]));
          if (msg.sender_id === activeUserId) {
            await supabase.from("chat_messages").update({ read: true } as any).eq("id", msg.id);
          }
        }

        // Conversation-Liste live aktualisieren
        if (!adminIds.has(msg.sender_id)) {
          const partnerId = msg.sender_id;
          setConversations((prev) => {
            const existing = prev.find(c => c.user_id === partnerId);
            if (existing) {
              return prev.map((c) =>
                c.user_id === partnerId
                  ? { ...c, unread: c.user_id === activeUserId ? 0 : c.unread + 1, lastMessage: msg.message, lastAt: msg.created_at, lastFromEmployeeAt: msg.created_at }
                  : c
              );
            }
            return prev;
          });

          // Neuer Mitarbeiter-Chat: Profil + Conversation laden und einfügen
          const currentConversations = conversationsRef.current;
          const exists = currentConversations.some(c => c.user_id === partnerId);
          let partnerName = exists ? (currentConversations.find(c => c.user_id === partnerId)?.full_name ?? "Mitarbeiter") : "Mitarbeiter";
          if (!exists) {
            const { data: prof } = await supabase
              .from("profiles").select("user_id, full_name").eq("user_id", partnerId).maybeSingle();
            const { data: conv } = await supabase
              .from("chat_conversations").select("status, escalated_at").eq("user_id", partnerId).maybeSingle();
            if (prof) {
              partnerName = prof.full_name;
              setConversations((prev) => prev.some(c => c.user_id === partnerId) ? prev : [{
                user_id: prof.user_id,
                full_name: prof.full_name,
                status: conv?.status ?? "direct",
                escalated_at: conv?.escalated_at ?? null,
                unread: 1,
                lastMessage: msg.message,
                lastAt: msg.created_at,
              }, ...prev]);
            }
          }

          // Browser-Notification + Ping (nur wenn nicht der gerade offene Chat)
          if (partnerId !== activeUserId) {
            notifyChat({ body: msg.message, senderName: partnerName });
          }
        } else {
          // Eigene Nachricht → lastMessage in Liste updaten + Unanswered-Flag löschen
          setConversations((prev) => prev.map((c) =>
            c.user_id === msg.receiver_id
              ? { ...c, lastMessage: msg.message, lastAt: msg.created_at, lastFromEmployeeAt: null }
              : c
          ));
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_conversations" }, (payload) => {
        const conv = payload.new as { user_id: string; status: string; escalated_at: string | null };
        setConversations((prev) => prev.map((c) =>
          c.user_id === conv.user_id ? { ...c, status: conv.status, escalated_at: conv.escalated_at } : c
        ));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.info("[Chat Realtime] Admin verbunden");
          setConnState("live");
          void syncActiveConversation();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn(`[Chat Realtime] Admin-Verbindung: ${status}`);
          setConnState("reconnecting");
          // Verlauf trotzdem aktuell halten, bis die Verbindung zurück ist.
          void syncActiveConversation();
        }
      });
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") void syncActiveConversation();
    };
    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("online", syncWhenVisible);
    window.addEventListener("focus", syncWhenVisible);
    // Stiller Fallback-Poll: fängt stumme Verbindungsabbrüche ab.
    const pollTimer = window.setInterval(syncWhenVisible, 25_000);
    return () => {
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.removeEventListener("online", syncWhenVisible);
      window.removeEventListener("focus", syncWhenVisible);
      window.clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [user, notifyChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Typing-Indicator: Channel pro selectedUserId (spiegelbild zu FloatingChat)
  useEffect(() => {
    if (!user || !selectedUserId) {
      setPartnerTyping(false);
      return;
    }
    const channelName = `typing-${[user.id, selectedUserId].sort().join("-")}`;
    const channel = supabase.channel(channelName, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId === selectedUserId) {
          if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
          if (payload.payload?.typing === false) {
            setPartnerTyping(false);
            return;
          }
          setPartnerTyping(true);
          typingTimeoutRef.current = window.setTimeout(() => setPartnerTyping(false), 3000);
        }
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
      setPartnerTyping(false);
    };
  }, [user, selectedUserId]);

  // Explizites Stop-Signal, sobald das Feld leer ist oder abgesendet wurde.
  const broadcastTyping = (text: string) => {
    if (!typingChannelRef.current || !user) return;
    if (text.trim().length === 0) {
      lastTypingSentRef.current = 0;
      typingChannelRef.current.send({
        type: "broadcast", event: "typing", payload: { userId: user.id, typing: false },
      });
      return;
    }
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id, typing: true },
    });
  };


  // Eigenen Online-Status laden (Profil des Teamleiters).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("leader_online")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled && data) setLeaderOnline((data as any).leader_online ?? true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  /** Schreibt den Status auf das eigene Profil und den Mandanten. */
  const setLeaderPresence = async (next: boolean) => {
    if (!user) return;
    setSavingPresence(true);
    const previous = leaderOnline;
    setLeaderOnline(next);
    try {
      const { data: me } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const { error } = await supabase
        .from("profiles")
        .update({ leader_online: next } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      const tenantId = (me as any)?.tenant_id;
      if (tenantId) {
        await supabase.from("tenants").update({ team_leader_online: next } as any).eq("id", tenantId);
      }
      toast({
        title: next ? "Du bist online" : "Du bist offline",
        description: next
          ? "Mitarbeiter sehen: Antwort in der Regel innerhalb weniger Minuten."
          : "Mitarbeiter sehen: Antwort innerhalb der nächsten Stunden.",
      });
    } catch (e: any) {
      setLeaderOnline(previous);
      toast({ title: "Status nicht gespeichert", description: e?.message ?? "Unbekannter Fehler", variant: "destructive" });
    } finally {
      setSavingPresence(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const tenantOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of conversations) {
      if (c.tenantId && c.tenantName) map.set(c.tenantId, c.tenantName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [conversations]);

  const activeCount = conversations.filter((c) => !c.hiddenAt).length;
  const hiddenCount = conversations.filter((c) => !!c.hiddenAt).length;

  const filteredConversations = conversations.filter((c) => {
    if (viewTab === "active" ? !!c.hiddenAt : !c.hiddenAt) return false;
    if (!c.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (tenantFilter !== "all" && c.tenantId !== tenantFilter) return false;
    if (filterTab === "escalated") return c.status === "escalated";
    if (filterTab === "open") return c.status !== "resolved";
    return true;
  });

  const selectedConv = conversations.find((c) => c.user_id === selectedUserId);
  const selectedName = selectedConv?.full_name ?? "";
  const selectedInitials = selectedName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  

  const statusBadge = (_status: string) => null;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground">Laden…</div></div>;
  }

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Conversation list */}
      <div className="w-80 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Chat</h2>
            <button
              type="button"
              onClick={() => void setLeaderPresence(!leaderOnline)}
              disabled={savingPresence}
              title="Sichtbarer Status für alle Mitarbeiter"
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-60",
                leaderOnline
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                  : "border-border bg-muted/50 text-muted-foreground",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", leaderOnline ? "bg-emerald-500" : "bg-muted-foreground/50")} />
              {leaderOnline ? "Online" : "Offline"}
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen…" className="pl-9 h-9 text-sm" />
          </div>
          {activityError && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-snug">
              Login-/Aktivitätsstatus nicht verfügbar: {activityError}
            </p>
          )}
          {/* Aktiv / Archiv */}
          <div className="flex gap-1">
            <button
              onClick={() => { setViewTab("active"); exitSelectMode(); }}
              className={cn(
                "flex-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                viewTab === "active" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              Aktiv ({activeCount})
            </button>
            <button
              onClick={() => { setViewTab("hidden"); exitSelectMode(); }}
              className={cn(
                "flex-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center justify-center gap-1",
                viewTab === "hidden" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <Archive className="h-3 w-3" /> Archiv ({hiddenCount})
            </button>
          </div>
          {/* Mehrfachauswahl ein-/ausschalten – deutlich sichtbar */}
          {!selectMode && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-[11px]"
              onClick={() => setSelectMode(true)}
            >
              <ListChecks className="h-3.5 w-3.5 mr-1.5" />
              Mehrere auswählen
            </Button>
          )}
          {/* Aktionsleiste bei Mehrfachauswahl */}
          {selectMode && (
            <div className="rounded-md border border-primary/40 bg-primary/5 px-2 py-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium flex-1">{selectedIds.size} ausgewählt</span>
                <button
                  onClick={() => setSelectedIds(
                    selectedIds.size === filteredConversations.length
                      ? new Set()
                      : new Set(filteredConversations.map((c) => c.user_id))
                  )}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  {selectedIds.size === filteredConversations.length && filteredConversations.length > 0 ? "Keine" : "Alle"}
                </button>
                <button onClick={exitSelectMode} className="text-muted-foreground hover:text-foreground" title="Auswahl beenden">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button
                size="sm"
                className="w-full h-7 text-[11px]"
                disabled={selectedIds.size === 0 || bulkBusy}
                onClick={() => void bulkSetHidden(viewTab === "active")}
              >
                {viewTab === "active" ? (
                  <><Archive className="h-3.5 w-3.5 mr-1.5" /> {selectedIds.size > 0 ? `${selectedIds.size} ` : ""}archivieren</>
                ) : (
                  <><ChevronRight className="h-3.5 w-3.5 mr-1.5" /> {selectedIds.size > 0 ? `${selectedIds.size} ` : ""}wiederherstellen</>
                )}
              </Button>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Tippe die Chats in der Liste an, um sie auszuwählen. Archivierte Chats bleiben im Tab „Archiv" erhalten – nichts wird gelöscht.
              </p>
            </div>
          )}
          {/* Tenant-Tabs */}
          {tenantOptions.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
              <button
                onClick={() => setTenantFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                  tenantFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                Alle ({conversations.length})
              </button>
              {tenantOptions.map((t) => {
                const count = conversations.filter((c) => c.tenantId === t.id).length;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTenantFilter(t.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                      tenantFilter === t.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {t.name} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Keine Chats</p>
          )}
          {filteredConversations.map((conv) => {
            const initials = conv.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
            const isChecked = selectedIds.has(conv.user_id);
            return (
              <button
                key={conv.user_id}
                onClick={() => (selectMode ? toggleSelectOne(conv.user_id) : selectConversation(conv.user_id))}
                className={cn(
                  "w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50",
                  !selectMode && selectedUserId === conv.user_id && "bg-primary/5 border-l-2 border-l-primary",
                  selectMode && isChecked && "bg-primary/10",
                  conv.status === "escalated" && "bg-destructive/[0.02]"
                )}
              >
                {selectMode && (
                  <span
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      isChecked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 bg-background"
                    )}
                    aria-hidden
                  >
                    {isChecked && <Check className="h-3 w-3" />}
                  </span>
                )}
                <div className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center shrink-0 relative",
                  conv.status === "escalated" ? "bg-destructive/10" : "bg-primary/10"
                )}>
                  <span className={cn("text-xs font-bold", conv.status === "escalated" ? "text-destructive" : "text-primary")}>{initials}</span>
                  {onlineUsers.has(conv.user_id) && (
                    <span
                      title="Aktuell online"
                      className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium truncate ${conv.blocked ? "line-through text-destructive" : "text-foreground"}`}>{conv.full_name}</p>
                    {conv.blocked && (
                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-medium">
                        Gesperrt
                      </span>
                    )}
                    {statusBadge(conv.status)}
                    {isUnanswered(conv) && !conv.adminNote && (
                      <span
                        title="Unbeantwortet seit > 4 h"
                        className="h-2 w-2 rounded-full bg-red-500 shrink-0"
                      />
                    )}
                    {conv.adminNote && (
                      <StickyNote className="h-3 w-3 text-amber-500 shrink-0" aria-label="Admin-Notiz vorhanden" />
                    )}
                  </div>
                  {conv.tenantName && (
                    <p className="text-[10px] text-primary/80 mt-0.5 flex items-center gap-1 truncate">
                      <Building2 className="h-2.5 w-2.5 shrink-0" /> {conv.tenantName}
                    </p>
                  )}
                  <p
                    className="text-[10px] text-muted-foreground mt-0.5"
                    title={activityTooltip(conv)}
                  >
                    {onlineUsers.has(conv.user_id)
                      ? <span className="text-green-600 font-medium">● Online</span>
                      : formatLastActive(activityAt(conv))}
                  </p>
                  {conv.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
                  )}
                </div>
                {(conv.unread > 0 || conv.adminUnread) && (
                  <Badge variant="default" className="h-5 min-w-[20px] px-1.5 text-[10px]">
                    {conv.unread > 0 ? conv.unread : "neu"}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!selectedUserId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Wähle einen Chat aus.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-border bg-card px-5 py-3 flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => navigate(`/admin/personen/${selectedUserId}`)}
                title="Mitarbeiter-Profil öffnen"
                className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors flex items-center justify-center"
              >
                <span className="text-xs font-bold text-primary">{selectedInitials}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/admin/personen/${selectedUserId}`)}
                className="flex-1 text-left group"
                title="Mitarbeiter-Profil öffnen"
              >
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold group-hover:text-primary transition-colors ${selectedConv?.blocked ? "line-through text-destructive" : "text-foreground"}`}>
                    {selectedName}
                    {selectedConv?.blocked && (
                      <span className="ml-2 align-middle no-underline text-[9px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-medium">
                        Gesperrt
                      </span>
                    )}
                  </p>
                  {selectedConv && statusBadge(selectedConv.status)}
                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {selectedConv?.tenantName && (
                  <p className="text-[11px] text-primary/80 flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3 w-3" /> {selectedConv.tenantName}
                  </p>
                )}
                {partnerTyping && (
                  <p className="text-[11px] text-primary flex items-center gap-1.5 mt-0.5 font-medium">
                    <span className="flex gap-0.5">
                      <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                    schreibt gerade live …
                  </p>
                )}
              </button>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleBlockedInChat(selectedUserId!, !selectedConv?.blocked)}
                  className={`text-xs ${selectedConv?.blocked ? "text-emerald-600" : "text-muted-foreground hover:text-destructive"}`}
                  title={selectedConv?.blocked ? "Zugang wieder freigeben" : "Zugang sperren"}
                >
                  <Lock className="h-3.5 w-3.5 mr-1" /> {selectedConv?.blocked ? "Freigeben" : "Sperren"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => markUnread(selectedUserId!)}
                  className="text-xs text-muted-foreground hover:text-primary"
                  title="Als ungelesen markieren – Chat erscheint wieder mit Badge"
                >
                  <MailOpen className="h-3.5 w-3.5 mr-1" /> Ungelesen
                </Button>

                {selectedConv?.hiddenAt ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => unhideConversation(selectedUserId!)}
                    className="text-xs text-muted-foreground hover:text-primary"
                    title="Chat wiederherstellen"
                  >
                    <ChevronRight className="h-3.5 w-3.5 mr-1" /> Wiederherstellen
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => hideConversation(selectedUserId!)}
                    disabled={hiding}
                    className="text-xs text-muted-foreground hover:text-destructive"
                    title="Chat archivieren – im Tab 'Archiv' weiter sichtbar"
                  >
                    <Archive className="h-3.5 w-3.5 mr-1" /> Archivieren
                  </Button>
                )}
              </div>
            </div>

            {/* Admin-Notiz – nur intern */}
            <div className="border-b border-border bg-amber-50/60 dark:bg-amber-950/20 px-5 py-3 shrink-0">
              <div className="flex items-center gap-2 mb-1.5">
                <StickyNote className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">Interne Notiz</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-700/80 dark:text-amber-300/70 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                  <Lock className="h-2.5 w-2.5" /> Nur für Teamleiter / Admin sichtbar
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="z. B. 'wartet auf Vertrag', 'hat angerufen', 'erreicht uns nicht' …"
                  rows={3}
                  className="flex-1 min-h-[72px] py-2 text-sm resize-y bg-background/60 border-amber-200 dark:border-amber-800/40"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveNote(selectedUserId!)}
                  disabled={savingNote || (noteDraft.trim() === (selectedConv?.adminNote ?? ""))}
                  className="text-xs h-9"
                >
                  Speichern
                </Button>
              </div>
              {isUnanswered(selectedConv!) && !selectedConv?.adminNote && (
                <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 mt-2">
                  <AlertCircle className="h-3 w-3" /> Seit über 4 Stunden unbeantwortet – kurz Notiz hinterlassen, falls du dranbleibst.
                </p>
              )}
            </div>


            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
              onScroll={(e) => {
                // Automatisch ältere Nachrichten nachladen, wenn nach oben gescrollt wird.
                if (hasMore && !loadingOlder && e.currentTarget.scrollTop < 40) void loadOlderMessages();
              }}
            >
              {connState === "reconnecting" && (
                <p className="text-center text-[11px] text-amber-600 dark:text-amber-400">
                  Verbindung unterbrochen – wird neu verbunden. Nachrichten gehen nicht verloren.
                </p>
              )}
              {historyError && (
                <div className="text-center">
                  <p className="text-xs text-red-600 dark:text-red-400 mb-2">{historyError}</p>
                  <Button variant="outline" size="sm" className="text-xs h-8"
                    onClick={() => selectConversation(selectedUserId!)}>
                    Erneut versuchen
                  </Button>
                </div>
              )}
              {hasMore && (
                <div className="text-center">
                  <Button variant="ghost" size="sm" className="text-xs h-8"
                    disabled={loadingOlder} onClick={loadOlderMessages}>
                    {loadingOlder ? "Lädt …" : "Ältere Nachrichten laden"}
                  </Button>
                </div>
              )}
              {messages.map((msg) => {

                // „Meine Nachricht" = von einem Admin-/Teamleiter-Konto gesendet
                const isMine = msg.sender_id === user!.id || adminIdsRef.current.has(msg.sender_id);
                const isAi = msg.is_ai;
                return (
                  <div key={msg.id} className={cn("flex items-end gap-2", isMine ? "justify-end" : "justify-start")}>
                    {!isMine && (
                      <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0 mb-1",
                        "bg-primary/10"
                      )}>
                        <span className="text-[10px] font-bold text-primary">{selectedInitials}</span>
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm relative group",
                      isMine
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}>
                      {editingId === msg.id ? (
                        <div className="space-y-2 min-w-[240px]">
                          <Textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            rows={2}
                            className="text-sm bg-background text-foreground"
                          />
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 text-xs">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" onClick={() => saveEdit(msg)} className="h-7 text-xs">
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {msg.message && <p className="whitespace-pre-wrap">{msg.message}</p>}
                          {msg.attachment_url && msg.attachment_type && (
                            <AttachmentPreview
                              url={msg.attachment_url}
                              name={msg.attachment_name ?? "Anhang"}
                              type={msg.attachment_type}
                            />
                          )}
                          <p className={cn("text-[10px] mt-1", isMine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                            {new Date(msg.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                            {(msg as any).edited_at && " · bearbeitet"}
                            {isMine && msg.delivery_status === "sending" && " · Wird gesendet…"}
                            {isMine && msg.delivery_status === "failed" && " · Nicht gesendet"}
                            {isMine && !msg.delivery_status && " · 👤 Admin"}
                          </p>
                          {isMine && msg.delivery_status === "failed" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => void retryMessage(msg)}
                              className="mt-1 h-6 px-2 text-[10px] text-primary-foreground hover:text-primary"
                            >
                              Erneut senden
                            </Button>
                          )}
                          {isMine && !isAi && !msg.delivery_status && (
                            <div className="absolute -top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(msg)}
                                title="Bearbeiten"
                                className="h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-primary shadow-sm"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteMessage(msg)}
                                title="Löschen"
                                className="h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-destructive shadow-sm"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border bg-card px-5 py-3 shrink-0 space-y-2">
              {pendingAttachment && (
                <div className="flex items-center gap-2 text-xs bg-muted/50 px-3 py-2 rounded-lg">
                  <span className="flex-1 truncate">📎 {pendingAttachment.name}</span>
                  <button
                    type="button"
                    onClick={() => setPendingAttachment(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Entfernen
                  </button>
                </div>
              )}
              {(suggestionActive || generatingAi) && (
                <div className="flex items-center gap-2 text-xs rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 text-blue-700">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1">
                    {generatingAi ? "Vorschlag wird erstellt …" : "Vorschlag — bitte prüfen, ändern oder senden."}
                  </span>
                  <button
                    type="button"
                    onClick={() => void generateSuggestion()}
                    disabled={generatingAi}
                    className="font-medium underline hover:no-underline disabled:opacity-50"
                  >
                    Neu
                  </button>
                  <button
                    type="button"
                    onClick={discardSuggestion}
                    disabled={generatingAi}
                    className="font-medium underline hover:no-underline disabled:opacity-50"
                  >
                    Verwerfen
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <ChatAttachmentButton
                  userId={user!.id}
                  onUploaded={setPendingAttachment}
                  disabled={!selectedUserId}
                />
                <EmojiPicker onSelect={(e) => setNewMessage((m) => m + e)} />
                <Textarea
                  value={newMessage}
                  onChange={(e) => { setNewMessage(e.target.value); setSuggestionActive(false); broadcastTyping(e.target.value); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Nachricht schreiben… (KI Stil-Support)"
                  rows={3}
                  className="flex-1 min-h-[80px] max-h-60 resize-y py-2 text-sm focus-visible:ring-blue-500"
                />
                <div className="flex flex-col gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => void generateSuggestion()}

                    disabled={generatingAi || !selectedUserId}
                    title="KI-Antwort in deinem Stil generieren"
                    className={cn(
                      "h-10 w-10 shrink-0 transition-all",
                      "text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-400",
                      generatingAi && "animate-pulse"
                    )}
                  >
                    {generatingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 fill-blue-50" />}
                  </Button>
                  <Button
                    size="icon"
                    onClick={sendMessage}
                    disabled={(!newMessage.trim() && !pendingAttachment) || sending}
                    className="h-10 w-10 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
