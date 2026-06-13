"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleDollarSign,
  Download,
  Home,
  Landmark,
  ReceiptText,
  Settings,
  WalletCards
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/portfolio", label: "Portfolio", icon: WalletCards },
  { href: "/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/dividends", label: "Dividends", icon: CircleDollarSign },
  { href: "/securities", label: "Securities", icon: Landmark },
  { href: "/imports", label: "Imports", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground",
              isActive && "bg-accent text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
