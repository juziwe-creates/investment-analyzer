import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { AppNavigation } from "@/components/app-navigation";
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
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-64 border-r bg-background px-4 py-6 md:block">
          <div className="mb-8">
            <p className="text-sm font-medium text-muted-foreground">Investment</p>
            <h1 className="text-xl font-semibold">Analyzer</h1>
          </div>
          <AppNavigation />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b bg-background/90 px-4 py-3 backdrop-blur md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Signed in as</p>
                <p className="truncate text-sm font-medium">{user.email}</p>
              </div>
              <form action={signOut}>
                <Button type="submit" variant="outline">
                  Sign out
                </Button>
              </form>
            </div>
            <div className="mt-3 md:hidden">
              <AppNavigation />
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

