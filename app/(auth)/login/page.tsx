import Link from "next/link";
import { signIn } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <AuthForm
      title="Sign in"
      description="Access your investment analytics workspace."
      action={signIn}
      buttonLabel="Sign in"
      message={message}
      footer={
        <>
          New to Investment Analyzer?{" "}
          <Link className="font-medium underline" href="/signup">
            Create an account
          </Link>
        </>
      }
    />
  );
}

