import { Link, useLocation } from "@/lib/router-compat";
import { Lock, Menu, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

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

/** Öffnet das mobile Menü der GlassSidebar (CustomEvent, wie das ⌘K-Pattern). */
export const openGlassNav = () => window.dispatchEvent(new CustomEvent("glass-nav-open"));

export function GlassMobileMenuButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openGlassNav}
      title="Menü öffnen"
      aria-label="Menü öffnen"
      className="lg:hidden h-11 w-11 rounded-full text-muted-foreground shrink-0"
    >
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
          {g.label && (
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.label}
            </p>
          )}
          <div className="space-y-1">
            {g.items.map((item) => {
              const active = item.end ? pathname === item.url : pathname.startsWith(item.url);
              const Icon = item.icon;
              return (
                <Link
                  key={item.url}
                  to={item.url}
                  onClick={onNavigate}
                  data-tour={item.tour}
                  aria-current={active ? "page" : undefined}
                  className={cn("glass-nav-link", active && "glass-nav-link-active")}
                >
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

export function GlassSidebar({
  brand,
  groups,
  footer,
  tour,
}: {
  brand: ReactNode;
  groups: GlassNavGroup[];
  footer?: ReactNode;
  tour?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("glass-nav-open", handler);
    return () => window.removeEventListener("glass-nav-open", handler);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <>
      {/* Desktop: feste Sidebar links */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 xl:w-72 p-3 xl:p-4 z-30" data-tour={tour}>
        <div className="glass-panel rounded-2xl flex flex-col w-full overflow-hidden">
          <div className="flex min-w-0 items-center gap-3 px-5 h-16 shrink-0">{brand}</div>
          <NavList groups={groups} />
          {footer && <div className="p-3 shrink-0">{footer}</div>}
        </div>
      </aside>

      {/* Mobile: Overlay-Menü */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 glass-overlay lg:hidden" />
          <Dialog.Content aria-describedby={undefined} className="glass-panel glass-mobile-nav fixed z-50 left-3 top-3 bottom-3 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl flex flex-col overflow-hidden lg:hidden">
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
            {footer && <div className="p-3 shrink-0" onClick={() => setOpen(false)}>{footer}</div>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
