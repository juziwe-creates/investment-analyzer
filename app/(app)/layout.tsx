import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
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

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen w-full">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  All Accounts
                </p>
                <p className="truncate text-sm font-medium text-foreground">{user.email}</p>
              </div>
              <form action={signOut}>
                <Button type="submit" variant="outline">
                  Sign out
                </Button>
              </form>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 xl:px-10">{children}</main>
        </div>
      </div>
      <MobileBottomNavigation />
    </div>
  );
}
