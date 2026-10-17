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
- Kontakt-Markierung (green/blue) lives only on applications.contact_marker; employees and chat resolve it via profiles.application_id / applications.user_id through src/hooks/use-contact-markers.ts. Why: one source of truth so a marker follows the person from applicant to employee to chat.
- Chat-Status „Antwort offen“ wird nur aus dem Nachrichtenverlauf berechnet (letzte echte Admin-Antwort vs. Mitarbeiter-Nachrichten), nie aus dem Lesestatus; SQL list_chat_conversations und src/lib/chat-open-status.ts müssen identisch bleiben. Why: ein gemeinsamer Admin-Account liest Chats, ohne zu antworten.
- Backups: the backup server pulls everything (scripts/backup-orchestrator.sh); production servers never get access to it. The archive layout (db/, backend/, frontend/, landing|bot|webid/) is the contract with scripts/restore.sh — change both together. Why: a blocked or compromised server must not be able to delete backups, and restores must find their files.
- The interview chat maps transport failures to applicant-safe messages and retries the failed action explicitly without adding a second optimistic bubble; provider errors must not be rendered to applicants.
