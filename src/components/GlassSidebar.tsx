import { Link, useLocation } from "@/lib/router-compat";
import { Lock, Menu, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import roomBg from "@/assets/portal-room-bg.jpg";

export type GlassNavItem = {
  title: string;
  url: string;
  icon: any;
  end?: boolean;
  badge?: number;
  locked?: boolean;
  dot?: boolean;
  tour?: string;
};
export type GlassNavGroup = { label?: string; items: GlassNavItem[] };

const isActive = (pathname: string, item: GlassNavItem) =>
  item.end ? pathname === item.url : pathname === item.url || pathname.startsWith(item.url + "/") || pathname.startsWith(item.url);

/** Öffnet das mobile Menü (CustomEvent, wie das ⌘K-Pattern). */
export const openGlassNav = () => window.dispatchEvent(new CustomEvent("glass-nav-open"));

/** Unscharfes Wohnraum-Foto hinter dem ganzen Portal. */
export function GlassBackdrop() {
  return <div aria-hidden className="glass-bg" style={{ backgroundImage: `url(${roomBg})` }} />;
}

export function GlassMobileMenuButton() {
  return (
    <Button variant="ghost" size="icon" onClick={openGlassNav} title="Menü öffnen" aria-label="Menü öffnen"
      className="lg:hidden h-11 w-11 rounded-full text-muted-foreground shrink-0">
      <Menu className="h-4 w-4" />
    </Button>
  );
}

function NavList({ groups, onNavigate }: { groups: GlassNavGroup[]; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Portal-Navigation" className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-5 px-3 pb-4">
      {groups.map((g, gi) => (
        <div key={g.label ?? gi}>
          {g.label && <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</p>}
          <div className="space-y-1">
            {g.items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <Link key={item.url} to={item.url} onClick={onNavigate} data-tour={item.tour}
                  aria-current={active ? "page" : undefined}
                  className={cn("glass-nav-link", active && "glass-nav-link-active")}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{item.title}</span>
                  {item.dot && <span className="ml-auto h-2 w-2 rounded-full bg-destructive shrink-0" />}
                  {item.locked && <Lock className="ml-auto h-3.5 w-3.5 opacity-60 shrink-0" />}
                  {!item.dot && !item.locked && !!item.badge && item.badge > 0 && (
                    <span className="glass-nav-badge">{item.badge > 99 ? "99+" : item.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Desktop: schwebende Symbol-Kapsel links (ein Symbol je Bereich). Mobil: Menü-Drawer. */
export function GlassSidebar({ brand, groups, footer, tour }: {
  brand: ReactNode; groups: GlassNavGroup[]; footer?: ReactNode; tour?: string;
}) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("glass-nav-open", handler);
    return () => window.removeEventListener("glass-nav-open", handler);
  }, []);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const close = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", close);
    return () => desktop.removeEventListener("change", close);
  }, []);

  // Gruppen mit Namen → ein Symbol (erster Eintrag), ungruppierte Einträge einzeln.
  const railItems = groups.flatMap((g) => {
    if (!g.label) return g.items.map((i) => ({ key: i.url, item: i, title: i.title, active: isActive(pathname, i), badge: i.badge, dot: i.dot, locked: i.locked }));
    const first = g.items[0];
    if (!first) return [];
    const badge = g.items.reduce((s, i) => s + (i.badge || 0), 0);
    return [{ key: g.label, item: first, title: g.label, active: g.items.some((i) => isActive(pathname, i)), badge, dot: g.items.some((i) => i.dot), locked: false }];
  });

  return (
    <>
      <aside className="hidden lg:flex fixed left-4 xl:left-6 top-1/2 -translate-y-1/2 z-30" data-tour={tour}>
        <nav aria-label="Portal-Navigation" className="glass-panel rounded-full flex flex-col items-center gap-1.5 p-1.5 max-h-[calc(100dvh-8rem)] overflow-visible">
          {railItems.map(({ key, item, title, active, badge, dot, locked }) => {
            const Icon = item.icon;
            return (
              <Link key={key} to={item.url} data-tour={item.tour} aria-label={title} aria-current={active ? "page" : undefined}
                className={cn("glass-rail-link", active && "glass-rail-link-active")}>
                <Icon className="h-[18px] w-[18px]" />
                {(dot || (!!badge && badge > 0)) && !locked && <span className="glass-rail-dot" />}
                {locked && <Lock className="absolute bottom-1 right-1 h-2.5 w-2.5 opacity-60" />}
                <span className="glass-rail-tip">{title}{!!badge && badge > 0 ? ` · ${badge > 99 ? "99+" : badge}` : ""}</span>
              </Link>
            );
          })}
          {footer && <div className="mt-1 pt-1.5 border-t border-border">{footer}</div>}
        </nav>
      </aside>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 glass-overlay lg:hidden" />
          <Dialog.Content aria-describedby={undefined} className="glass-panel glass-mobile-nav fixed z-50 left-3 top-3 bottom-3 w-80 max-w-[calc(100vw-1.5rem)] rounded-3xl flex flex-col overflow-hidden lg:hidden">
            <Dialog.Title className="sr-only">Portal-Menü</Dialog.Title>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 h-16 shrink-0">
              <div className="flex min-w-0 items-center gap-3">{brand}</div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" title="Menü schließen" aria-label="Menü schließen" className="h-11 w-11 rounded-full shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>
            <NavList groups={groups} onNavigate={() => setOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/** Untere Reiterleiste: Unterseiten des aktuellen Bereichs (oder Hauptbereiche). */
export function GlassTabDock({ groups, action }: { groups: GlassNavGroup[]; action?: ReactNode }) {
  const { pathname } = useLocation();
  const current = groups.find((g) => g.label && g.items.some((i) => isActive(pathname, i)));
  const tabs: GlassNavItem[] = current
    ? current.items
    : groups.flatMap((g) => (g.label ? (g.items[0] ? [{ ...g.items[0], title: g.label }] : []) : g.items));
  if (tabs.length === 0) return null;
  return (
    <div className="glass-dock fixed bottom-0 inset-x-0 z-30 flex justify-center px-3 pointer-events-none">
      <nav aria-label={current?.label ?? "Bereiche"} className="glass-panel pointer-events-auto rounded-full flex items-center gap-1 p-1.5 max-w-full">
        <div className="glass-dock-scroll flex items-center gap-1 overflow-x-auto min-w-0">
          {tabs.map((t) => {
            const active = current ? isActive(pathname, t) : groups.some((g) => g.label === t.title && g.items.some((i) => isActive(pathname, i))) || isActive(pathname, t);
            return (
              <Link key={t.url + t.title} to={t.url} aria-current={active ? "page" : undefined} className={cn("glass-tab", active && "glass-tab-active")}>
                <span>{t.title}</span>
                {!!t.badge && t.badge > 0 && <span className="glass-nav-badge ml-0">{t.badge > 99 ? "99+" : t.badge}</span>}
                {t.locked && <Lock className="h-3 w-3 opacity-60" />}
              </Link>
            );
          })}
        </div>
        {action}
      </nav>
    </div>
  );
}
