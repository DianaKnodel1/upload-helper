import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DockLink = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  end?: boolean;
  badge?: number;
  locked?: boolean;
  dot?: boolean;
  tour?: string;
};
export type DockEntry =
  | ({ kind: "link" } & DockLink)
  | { kind: "group"; title: string; icon: DockLink["icon"]; items: DockLink[] };

const matches = (path: string, l: DockLink) => (l.end ? path === l.url : path === l.url || path.startsWith(l.url + "/"));

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-semibold items-center justify-center leading-none">
      {n > 99 ? "99+" : n}
    </span>
  );
}

function DockButtonInner({ icon: Icon, title, active, badge, dot }: { icon: DockLink["icon"]; title: string; active: boolean; badge?: number; dot?: boolean }) {
  return (
    <>
      <span className="relative shrink-0">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
        <Badge n={badge ?? 0} />
        {dot && !badge && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />}
      </span>
      <span className={cn("text-[10.5px] sm:text-xs font-medium whitespace-nowrap", active ? "inline" : "hidden lg:inline")}>{title}</span>
    </>
  );
}

const itemCls = "glass-dock-item relative flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-2 rounded-full h-12 px-3 lg:px-4 shrink-0";

export function GlassDock({ entries, tour }: { entries: DockEntry[]; tour?: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  return (
    <nav
      data-tour={tour}
      aria-label="Hauptnavigation"
      className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-1.5rem)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="glass-dock rounded-full p-1.5 flex items-center gap-1 overflow-x-auto">
        {entries.map((e) => {
          if (e.kind === "link") {
            const active = !e.locked && matches(path, e);
            return (
              <Link
                key={e.url}
                to={e.locked ? "." : e.url}
                data-tour={e.tour}
                data-active={active}
                aria-current={active ? "page" : undefined}
                title={e.title}
                onClick={(ev) => { if (e.locked) ev.preventDefault(); }}
                className={cn(itemCls, e.locked && "opacity-40 cursor-not-allowed")}
              >
                <DockButtonInner icon={e.locked ? Lock : e.icon} title={e.title} active={active} badge={e.badge} dot={e.dot} />
              </Link>
            );
          }
          const active = e.items.some((i) => matches(path, i));
          const badge = e.items.reduce((s, i) => s + (i.badge ?? 0), 0);
          const current = e.items.find((i) => matches(path, i));
          return (
            <Popover key={e.title} open={openGroup === e.title} onOpenChange={(o) => setOpenGroup(o ? e.title : null)}>
              <PopoverTrigger asChild>
                <button type="button" data-active={active} title={e.title} className={itemCls}>
                  <DockButtonInner icon={e.icon} title={current?.title ?? e.title} active={active} badge={badge} />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" sideOffset={14} className="w-64 rounded-2xl p-2">
                <div className="px-2 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{e.title}</div>
                <div className="flex flex-col gap-0.5">
                  {e.items.map((i) => {
                    const a = matches(path, i);
                    return (
                      <Link
                        key={i.url}
                        to={i.url}
                        onClick={() => setOpenGroup(null)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors",
                          a ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                        )}
                      >
                        <i.icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                        <span className="flex-1 truncate">{i.title}</span>
                        {!!i.badge && (
                          <span className="inline-flex h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold items-center justify-center">
                            {i.badge > 99 ? "99+" : i.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </nav>
  );
}
