import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AdminBadges {
  unreadChat: number;
  pendingKyc: number;
  newApplications: number;
}

export function useAdminBadges(): AdminBadges {
  const { user, isAdmin } = useAuth();
  const [badges, setBadges] = useState<AdminBadges>({ unreadChat: 0, pendingKyc: 0, newApplications: 0 });

  useEffect(() => {
    if (!user || !isAdmin) return;
    let cancelled = false;

    const load = async () => {
      // Chat-Zähler = Anzahl Chats mit offener Antwort (ein Chat = ein Fall),
      // unabhängig von gelesen/ungelesen und vom Empfänger-Konto.
      const openChatsPromise = (async () => {
        const { data, error } = await (supabase as any).rpc("list_chat_conversations");
        const rows = (data ?? []) as any[];
        if (!error && (rows.length === 0 || "open_count" in rows[0])) {
          return rows.filter((r) => Number(r.open_count ?? 0) > 0).length;
        }
        // Rückfall, solange die neue Serverfunktion noch nicht eingespielt ist.
        const res = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("receiver_id", user.id)
          .eq("read", false)
          .not("message", "ilike", "[ESCALATE]%")
          .not("message", "ilike", "🤖 KI-Eskalation%")
          .not("message", "ilike", "🤖 KI Eskalation%");
        return res.count ?? 0;
      })();
      const [openChats, kycRes, appRes] = await Promise.all([
        openChatsPromise.catch(() => 0),
        supabase
          .from("kyc_verifications")
          .select("id", { count: "exact", head: true })
          .eq("status", "eingereicht"),
        supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .eq("status", "neu"),
      ]);
      if (cancelled) return;
      setBadges({
        unreadChat: openChats,
        pendingKyc: kycRes.count ?? 0,
        newApplications: appRes.count ?? 0,
      });
    };

    load();

    const channel = supabase
      .channel("admin-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_verifications" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, load)
      .subscribe();

    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, isAdmin]);

  return badges;
}
