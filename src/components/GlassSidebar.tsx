import { Link, useLocation } from "@/lib/router-compat";
import { Lock, Menu, X } from "lucide-react";
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
    <button
      onClick={openGlassNav}
      title="Menü öffnen"
      className="lg:hidden h-9 w-9 grid place-items-center rounded-full hover:bg-accent text-muted-foreground hover:text-foreground shrink-0"
    >
      <Menu className="h-4 w-4" />
    </button>
  );
}

function NavList({ groups, onNavigate }: { groups: GlassNavGroup[]; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav className="flex-1 overflow-y-auto space-y-5 px-3 pb-4">
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
                  className={cn("glass-nav-link", active && "glass-nav-link-active")}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.title}</span>
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

  return (
    <>
      {/* Desktop: feste Sidebar links */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-72 p-4 z-30" data-tour={tour}>
        <div className="glass-panel rounded-2xl flex flex-col w-full overflow-hidden">
          <div className="flex items-center gap-3 px-5 h-16 shrink-0">{brand}</div>
          <NavList groups={groups} />
          {footer && <div className="p-3 shrink-0">{footer}</div>}
        </div>
      </aside>

      {/* Mobile: Overlay-Menü */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 glass-overlay" onClick={() => setOpen(false)} />
          <div className="glass-panel absolute inset-y-0 left-0 w-72 m-3 rounded-2xl flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-5 h-16 shrink-0">
              {brand}
              <button
                onClick={() => setOpen(false)}
                title="Menü schließen"
                className="ml-auto h-9 w-9 grid place-items-center rounded-full hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavList groups={groups} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
