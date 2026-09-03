import type { ReactNode } from "react";
import { AlphaLogo } from "@/components/alpha-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthFormProps = {
  title: string;
  description: string;
  action: (formData: FormData) => Promise<void>;
  buttonLabel: string;
  message?: string;
  footer: ReactNode;
};

export function AuthForm({
  title,
  description,
  action,
  buttonLabel,
  message,
  footer
}: AuthFormProps) {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="mx-auto w-full max-w-md">
        <AlphaLogo className="mb-12" />
        <p className="alpha-kpi-label mb-4">Private investment analytics</p>
        <h1 className="text-4xl font-medium tracking-[-0.03em] text-foreground md:text-5xl">
          Understand your investments.
        </h1>
        <p className="mt-5 max-w-sm text-base leading-7 text-muted-foreground">
          Analyze every investment. Measure every decision.
        </p>
      </section>

      <section className="mx-auto w-full max-w-md rounded-lg border border-border/80 bg-card p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-medium tracking-[-0.02em]">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <form action={action} className="space-y-5">
          {message ? (
            <div className="rounded-md border border-border/80 bg-muted/70 px-3 py-2 text-sm text-muted-foreground">
              {message}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full">
            {buttonLabel}
          </Button>
          <p className="text-center text-sm text-muted-foreground">{footer}</p>
        </form>
      </section>
    </div>
  );
}
