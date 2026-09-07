"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Landmark,
  ReceiptText,
  Settings,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AlphaLogo } from "@/components/alpha-logo";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const primaryNavItems: NavItem[] = [
  { href: "/dashboard", label: "Portfolio", icon: WalletCards },
  { href: "/portfolio", label: "Investments", icon: Landmark },
  { href: "/dividends", label: "Dividends", icon: CircleDollarSign },
  { href: "/transactions", label: "Transactions", icon: ReceiptText }
];

const secondaryNavItems: NavItem[] = [
  { href: "/imports", label: "Import", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings }
];

const mobileNavItems: NavItem[] = [
  { href: "/dashboard", label: "Portfolio", icon: WalletCards },
  { href: "/portfolio", label: "Investments", icon: Landmark },
  { href: "/dividends", label: "Dividends", icon: CircleDollarSign }
];

const mobileMoreItems: NavItem[] = [
  { href: "/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/imports", label: "Import", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings }
];

function NavLink({
  collapsed,
  href,
  icon: Icon,
  label
}: {
  collapsed?: boolean;
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isActive = pathname === href;
  const portfolio = searchParams.get("portfolio");
  const target = portfolio ? `${href}?portfolio=${encodeURIComponent(portfolio)}` : href;

  return (
    <Link
      href={target}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition duration-200 hover:bg-[hsl(var(--accent-subtle))] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed && "justify-center px-2",
        isActive && "bg-[hsl(var(--accent-subtle))] text-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 text-muted-foreground transition-colors group-hover:text-[hsl(var(--accent-brand))]",
          isActive && "text-[hsl(var(--accent-brand))]"
        )}
      />
      {!collapsed ? <span>{label}</span> : null}
    </Link>
  );
}

function NavGroup({
  collapsed,
  items,
  label
}: {
  collapsed: boolean;
  items: NavItem[];
  label?: string;
}) {
  return (
    <div className="space-y-1">
      {label && !collapsed ? (
        <p className="px-3 pb-1 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
      ) : null}
      {items.map((item) => (
        <NavLink key={item.href} collapsed={collapsed} {...item} />
      ))}
    </div>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r border-border/70 bg-card px-3 py-5 transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-[var(--sidebar-collapsed)]" : "w-[var(--sidebar-expanded)]"
      )}
    >
      <div className="mb-7 flex items-center justify-between px-2">
        <AlphaLogo collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="space-y-6">
        <NavGroup collapsed={collapsed} items={primaryNavItems} />
        <div className="h-px bg-border/80" />
        <NavGroup collapsed={collapsed} items={secondaryNavItems} label="Workspace" />
      </nav>
    </aside>
  );
}

export function MobileBottomNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const portfolio = searchParams.get("portfolio");
  const targetFor = (href: string) =>
    portfolio ? `${href}?portfolio=${encodeURIComponent(portfolio)}` : href;
  const moreIsActive = mobileMoreItems.some((item) => item.href === pathname);

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-x-3 bottom-20 z-40 rounded-lg border border-border bg-card p-2 shadow-[0_18px_50px_hsl(var(--foreground)/0.14)] md:hidden">
          {mobileMoreItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={targetFor(item.href)}
                onClick={() => setMoreOpen(false)}
                className="alpha-focus flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-[hsl(var(--accent-subtle))] hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border/80 bg-card/95 px-2 py-2 backdrop-blur md:hidden">
      {mobileNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={targetFor(item.href)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md px-2 py-1.5 text-[0.68rem] font-medium text-muted-foreground transition hover:bg-[hsl(var(--accent-subtle))]",
              isActive && "text-foreground"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4",
                isActive && "text-[hsl(var(--accent-brand))]"
              )}
            />
            {item.label}
          </Link>
        );
      })}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-label="Open more navigation"
          onClick={() => setMoreOpen((open) => !open)}
          className={cn(
            "alpha-focus flex flex-col items-center gap-1 rounded-md px-2 py-1.5 text-[0.68rem] font-medium text-muted-foreground transition hover:bg-[hsl(var(--accent-subtle))]",
            moreIsActive && "text-foreground"
          )}
        >
          <ReceiptText className={cn("h-4 w-4", moreIsActive && "text-[hsl(var(--accent-brand))]")} />
          More
        </button>
      </nav>
    </>
  );
}

export function AppNavigation() {
  return <NavGroup collapsed={false} items={primaryNavItems} />;
}
