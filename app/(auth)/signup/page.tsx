import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <AuthForm
      title="Create account"
      description="Start tracking decisions from transaction-level data."
      action={signUp}
      buttonLabel="Create account"
      message={message}
      footer={
        <>
          Already have an account?{" "}
          <Link className="font-medium underline" href="/login">
            Sign in
          </Link>
        </>
      }
    />
  );
}

