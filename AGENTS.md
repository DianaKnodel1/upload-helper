<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Saved section templates and section-based pages are selected, previewed, recolored, and saved directly in the classic generator; the Baukasten is never part of that selection flow. Keeps one renderer for section pages.
- Website-Themes (site-N) declare their palette in meta.json `colors`; the generator pre-fills branding colors on theme selection, and theme CSS keeps element base rules inside :where() so component classes (buttons, headings) always win. Why: otherwise every theme looked like the tenant default color and base rules hid button text.
- Application-duration hints are injected by the shared theme registry after the CTA group and inherit the surrounding theme typography and color. Why: helper text must not become a third button or split the action row in previews or live pages.
- Kontakt-Markierung (green/blue) lives only on applications.contact_marker; employees and chat resolve it via profiles.application_id / applications.user_id through src/hooks/use-contact-markers.ts. Why: one source of truth so a marker follows the person from applicant to employee to chat.
- Chat-Status „Antwort offen“ wird nur aus dem Nachrichtenverlauf berechnet (letzte echte Admin-Antwort vs. Mitarbeiter-Nachrichten), nie aus dem Lesestatus; SQL list_chat_conversations und src/lib/chat-open-status.ts müssen identisch bleiben. Why: ein gemeinsamer Admin-Account liest Chats, ohne zu antworten.
- Backups: the backup server pulls everything (scripts/backup-orchestrator.sh); production servers never get access to it. The archive layout (db/, backend/, frontend/, landing|bot|webid/) is the contract with scripts/restore.sh — change both together. Why: a blocked or compromised server must not be able to delete backups, and restores must find their files.
- The interview chat maps transport failures to applicant-safe messages and retries the failed action explicitly without adding a second optimistic bubble; provider errors must not be rendered to applicants.
- Standard contracts are shared raw text templates per employment type, used by admin presets and registration fallbacks; employer identity and signing data are placeholders so tenant data never leaks between companies.
- The German portal opts out of automatic DOM translation; submission controls isolate dynamic icons from text in stable elements to prevent third-party text replacement from breaking React reconciliation.
- Lead mailing uses Resend with single-recipient sends and the existing cron limits; inbound mail uses the Svix-verified webhook plus admin-only receiving sync, checked inserts and provider-index deduplication. Why: preserves one audit trail without silently ignoring persistence failures or relying on unsupported partial-index conflict inference.
- All portal emails render through src/lib/mail-template.ts (escaped HTML + text fallback, per-tenant signature from lead_mail_settings sig_* with tenant fallbacks); the single admin Postfach threads lead_messages by peer_email and kind (lead/employee/other), and only sends one recipient at a time. Why: one layout and one audit trail for leads, applicants and employees.
- Interview prompts always append buildTeamNotesBlock + buildInterviewFactsBlock (src/lib/interview-facts.ts) in both the chat route and interview-engine; statutory figures live only there. Why: the model must never answer with stale training data (dates, Minijob limit).
- Portal layouts share src/components/GlassSidebar.tsx: milky-glass text sidebar on desktop, Radix modal drawer on mobile, light/dark toggle in the header. Why: one navigation model for admin and employee portals with focus trapping and scroll locking.
- External premium themes live in src/landing-themes/site-N (N ≥ 16), are auto-registered via import.meta.glob in src/lib/landing-themes.ts, declare explicit slot types in meta.json, and must pass src/test/premium-theme-standard.test.ts; the contract is docs/PREMIUM-THEMES.md. Why: Claude-built themes integrate without registry edits while site-1…15 stay untouched.
- Date-based account cleanup preserves accounts linked to retained chat messages or newer applications and excludes messages from generic user-linked deletion; this keeps retained records attributable and visible.
