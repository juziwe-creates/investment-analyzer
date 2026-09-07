import { redirect } from "next/navigation";

export default async function SecuritiesRedirect({ searchParams }: { searchParams: Promise<{ portfolio?: string }> }) {
  const { portfolio } = await searchParams;
  redirect(portfolio ? `/portfolio?portfolio=${encodeURIComponent(portfolio)}` : "/portfolio");
}
