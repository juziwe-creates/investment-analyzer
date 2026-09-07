import { Suspense } from "react";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { AccountSelector } from "@/components/account-selector";
import { AppSidebar, MobileBottomNavigation } from "@/components/app-navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id,name")
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen w-full">
        <Suspense fallback={<aside className="hidden w-[var(--sidebar-expanded)] border-r border-border/70 bg-card md:block" />}>
          <AppSidebar />
        </Suspense>

        <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur md:px-8">
            <div className="flex items-center justify-between gap-4">
              <p className="truncate text-sm font-medium text-foreground">{user.email}</p>
              <div className="flex items-center gap-2">
                <Suspense fallback={<div className="h-9 w-32 animate-pulse rounded-md bg-muted" />}>
                  <AccountSelector portfolios={portfolios ?? []} />
                </Suspense>
                <form action={signOut}>
                  <Button type="submit" variant="outline">
                    Sign out
                  </Button>
                </form>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 xl:px-10">{children}</main>
        </div>
      </div>
      <Suspense fallback={null}>
        <MobileBottomNavigation />
      </Suspense>
    </div>
  );
}
