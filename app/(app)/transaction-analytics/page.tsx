import { redirect } from "next/navigation";

export default async function TransactionAnalyticsRedirect({ searchParams }: { searchParams: Promise<{ portfolio?: string }> }) {
  const { portfolio } = await searchParams;
  redirect(portfolio ? `/transactions?portfolio=${encodeURIComponent(portfolio)}` : "/transactions");
}
