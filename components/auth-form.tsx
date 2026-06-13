import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          {message ? (
            <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
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
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-4">
          <Button type="submit">{buttonLabel}</Button>
          <p className="text-center text-sm text-muted-foreground">{footer}</p>
        </CardFooter>
      </form>
    </Card>
  );
}

