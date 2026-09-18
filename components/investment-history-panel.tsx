"use client";

import { useMemo } from "react";
import { InvestmentDetailChart, type InvestmentMarker } from "@/components/investment-detail-chart";
import { PurchaseLotsTable } from "@/components/purchase-lots-table";
import { TimeViewportProvider } from "@/components/time-viewport";
import type { InvestmentChartPoint } from "@/lib/analytics/investment-history";
import type { PersonalDividendEvent } from "@/lib/analytics/dividends";
import type { LotProfitability } from "@/lib/analytics/profitability";

export function InvestmentHistoryPanel({ points, markers, dividends, lots }: { points: InvestmentChartPoint[]; markers: InvestmentMarker[]; dividends: PersonalDividendEvent[]; lots: LotProfitability[] }) {
  const dates = useMemo(() => [...points.map((point) => point.date), ...markers.map((marker) => marker.date), ...lots.map((lot) => lot.tradeDate)], [points, markers, lots]);
  return <TimeViewportProvider dates={dates}><InvestmentDetailChart points={points} markers={markers} dividends={dividends} /><PurchaseLotsTable lots={lots} /></TimeViewportProvider>;
}
