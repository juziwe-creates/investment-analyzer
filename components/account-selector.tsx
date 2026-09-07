"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type AccountSelectorProps = {
  portfolios: { id: string; name: string }[];
};

export function AccountSelector({ portfolios }: AccountSelectorProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPortfolio = searchParams.get("portfolio") ?? "all";

  function selectPortfolio(portfolioId: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (portfolioId === "all") {
      params.delete("portfolio");
    } else {
      params.set("portfolio", portfolioId);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Portfolio account</span>
      <select
        aria-label="Portfolio account"
        className="alpha-focus h-9 max-w-52 rounded-md border border-border/80 bg-card px-3 text-sm font-medium text-foreground"
        value={currentPortfolio}
        onChange={(event) => selectPortfolio(event.target.value)}
      >
        <option value="all">All Accounts</option>
        {portfolios.map((portfolio) => (
          <option key={portfolio.id} value={portfolio.id}>
            {portfolio.name}
          </option>
        ))}
      </select>
    </label>
  );
}
