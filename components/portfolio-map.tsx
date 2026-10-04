"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { benchmarkOptions, type BenchmarkId } from "@/lib/analytics/benchmarks";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";
import { MAP_HEIGHT, MAP_WIDTH, performanceLayout, portfolioLayout, sectorLayout, type LayoutInput } from "@/lib/portfolio-map/layout";
import type { MapHolding, MapLot, PortfolioMapModel } from "@/lib/portfolio-map/model";
import { cn } from "@/lib/utils";

type Mode = "portfolio" | "sectors" | "performance";

const modes: { id: Mode; label: string }[] = [
  { id: "portfolio", label: "Portfolio" }, { id: "sectors", label: "Sectors" }, { id: "performance", label: "Performance" }
];

function money(value: number | null, currency = "EUR") {
  return value === null ? "Unavailable" : formatCurrency(value, currency);
}

function percent(value: number | null) {
  return value === null ? "Unavailable" : formatPercent(value);
}

function percentagePoints(value: number | null) {
  return value === null ? "Unavailable" : `${new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" }).format(value)} pp`;
}

function tone(value: number | null) {
  return value === null ? "#87909d" : value > 0 ? "#79aa96" : value < 0 ? "#ca858a" : "#87909d";
}

function mapInputs(holdings: MapHolding[]): LayoutInput[] {
  return holdings.map((holding) => ({ key: holding.key, weight: holding.weight, sector: holding.sector, relativeReturn: holding.relativeReturn }));
}

function HoldingDetails({ holding, benchmarkLabel }: { holding: MapHolding | null; benchmarkLabel: string }) {
  if (!holding) return <p className="text-sm text-[#a8b2bd]">Focus an investment to inspect its values.</p>;
  return <div className="flex flex-wrap items-start justify-between gap-5">
    <div className="min-w-0"><p className="truncate text-lg font-medium text-white">{holding.name}</p><p className="mt-1 text-xs text-[#a8b2bd]">{formatNumber(holding.quantity)} shares | {holding.sector}</p></div>
    <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm tabular-nums">
      <div><dt className="text-xs text-[#a8b2bd]">Portfolio weight</dt><dd className="mt-1 text-white">{percent(holding.weight)}</dd></div>
      <div><dt className="text-xs text-[#a8b2bd]">Market value</dt><dd className="mt-1 text-white">{money(holding.value, holding.currency)}</dd></div>
      <div><dt className="text-xs text-[#a8b2bd]">Total return</dt><dd className="mt-1 text-white">{percent(holding.totalReturn)}</dd></div>
      <div title={holding.comparisonReason ?? undefined}><dt className="text-xs text-[#a8b2bd]">Vs {benchmarkLabel}</dt><dd className="mt-1 text-white">{percentagePoints(holding.relativeReturn)}</dd></div>
    </dl>
  </div>;
}

function LotDetails({ lot, benchmarkLabel }: { lot: MapLot | null; benchmarkLabel: string }) {
  if (!lot) return <p className="text-sm text-[#a8b2bd]">Select a purchase decision for its comparison.</p>;
  return <div className="flex flex-wrap items-start justify-between gap-5">
    <div><p className="text-sm font-medium text-white">Purchase {formatDate(lot.date)}</p><p className="mt-1 text-xs text-[#a8b2bd]">{formatNumber(lot.remainingQuantity)} of {formatNumber(lot.quantity)} shares remaining</p></div>
    <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm tabular-nums">
      <div><dt className="text-xs text-[#a8b2bd]">Acquisition cost</dt><dd className="mt-1 text-white">{money(lot.cost, lot.currency)}</dd></div>
      <div><dt className="text-xs text-[#a8b2bd]">Actual economic value</dt><dd className="mt-1 text-white">{money(lot.actualEconomicValue, lot.currency)}</dd></div>
      <div><dt className="text-xs text-[#a8b2bd]">{benchmarkLabel} equivalent</dt><dd className="mt-1 text-white">{money(lot.benchmarkValue)}</dd></div>
      <div><dt className="text-xs text-[#a8b2bd]">Return difference</dt><dd className="mt-1 text-white">{percentagePoints(lot.returnDifference)}</dd></div>
    </dl>
    {lot.reason ? <p className="w-full text-xs text-[#c1a48b]">{lot.reason}</p> : null}
  </div>;
}

function DecisionMap({ holding, benchmarkLabel, compare, onCompare, onBack }: {
  holding: MapHolding; benchmarkLabel: string; compare: boolean; onCompare: (value: boolean) => void; onBack: () => void;
}) {
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const selectedLot = holding.lots.find((lot) => lot.id === selectedLotId) ?? null;
  const maximum = Math.max(1, ...holding.lots.map((lot) => lot.cost));
  useEffect(() => { backRef.current?.focus(); }, []);
  return <div className="min-h-[620px] px-5 pb-6 pt-5 sm:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><button ref={backRef} type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-[#bbc5d0] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8da9f1]"><ArrowLeft size={16} />Portfolio Map</button><Link href={holding.href} className="inline-flex items-center gap-2 text-sm text-[#bbc5d0] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8da9f1]">Open Investment Detail<ExternalLink size={14} /></Link></div>
    <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center text-center"><div className="flex h-28 w-28 items-center justify-center rounded-full border border-[#7795d6] bg-[#29364c] text-3xl font-medium text-white shadow-[0_16px_36px_#0005]">{holding.monogram}</div><h2 className="mt-5 text-2xl font-medium text-white">{holding.name}</h2><p className="mt-2 text-sm tabular-nums text-[#bbc5d0]">{money(holding.value, holding.currency)} current value | {percent(holding.totalReturn)} total return</p></div>
    <div className="mx-auto mt-8 flex max-w-5xl flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3"><p className="text-xs font-medium uppercase text-[#a8b2bd]">Purchase decisions | {holding.lots.length}</p><label className="flex items-center gap-2 text-sm text-[#d1d9e2]"><input type="checkbox" checked={compare} onChange={(event) => onCompare(event.target.checked)} className="accent-[#7896db]" />Compare with {benchmarkLabel}</label></div>
    <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-5 gap-y-8 py-8 sm:grid-cols-3 lg:grid-cols-5">{holding.lots.map((lot) => {
      const size = 50 + 34 * Math.sqrt(Math.max(0, lot.cost) / maximum);
      const active = selectedLotId === lot.id;
      return <button key={lot.id} type="button" aria-pressed={active} aria-label={`Purchase ${formatDate(lot.date)}, ${money(lot.cost)}, ${lot.remainingQuantity > 0 ? "open" : "closed"}`} onClick={() => setSelectedLotId(lot.id)} className={cn("group flex min-w-0 flex-col items-center text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8da9f1]", active && "text-white")}>
        <span className="flex h-24 items-center justify-center gap-2"><span className="flex aspect-square items-center justify-center rounded-full bg-[#28333d] text-xs font-medium tabular-nums text-white shadow-[0_8px_22px_#0005] transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none" style={{ width: size, border: `${lot.remainingQuantity > 0 ? "2px solid" : "2px dashed"} ${tone(lot.actualReturn)}` }}>{percent(lot.actualReturn)}</span>{compare ? <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-[#9caabc] bg-[#9caabc]/10 text-[10px] text-[#c3cedb]">{lot.benchmarkReturn === null ? "-" : percent(lot.benchmarkReturn)}</span> : null}</span>
        <span className="mt-2 text-xs tabular-nums text-[#d7dfe8]">{formatDate(lot.date)}</span><span className="mt-1 text-xs tabular-nums text-[#a8b2bd]">{money(lot.cost, lot.currency)}</span><span className="mt-1 text-[11px] text-[#a8b2bd]">{lot.remainingQuantity <= 0 ? "Closed" : lot.remainingQuantity < lot.quantity ? "Partial" : "Open"}</span>
      </button>;
    })}</div>
    <div className="mx-auto max-w-5xl border-t border-white/15 pt-5"><LotDetails lot={selectedLot} benchmarkLabel={benchmarkLabel} /></div>
  </div>;
}

export function PortfolioMap({ model, portfolioId }: { model: PortfolioMapModel; portfolioId?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("portfolio");
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const desktopButtons = useRef(new Map<string, HTMLButtonElement>());
  const mobileButtons = useRef(new Map<string, HTMLButtonElement>());
  const previousSelected = useRef<string | null>(null);
  const selected = model.holdings.find((holding) => holding.key === selectedKey) ?? null;
  const focused = model.holdings.find((holding) => holding.key === focusedKey) ?? null;
  const inputs = useMemo(() => mapInputs(model.holdings), [model.holdings]);
  const portfolio = useMemo(() => portfolioLayout(inputs), [inputs]);
  const sectors = useMemo(() => sectorLayout(inputs), [inputs]);
  const performance = useMemo(() => performanceLayout(inputs), [inputs]);
  const positions = mode === "portfolio" ? portfolio : mode === "sectors" ? sectors.positions : performance.positions;
  const byKey = new Map(positions.map((position) => [position.key, position]));
  const unplaced = model.holdings.filter((holding) => !byKey.has(holding.key));
  const hasClassification = model.holdings.some((holding) => holding.sector !== "Unclassified");
  const mobileRows = mode === "sectors" ? [...model.holdings].sort((a, b) => a.sector.localeCompare(b.sector) || (b.weight ?? -1) - (a.weight ?? -1))
    : mode === "performance" ? [...model.holdings].sort((a, b) => (b.relativeReturn ?? -Infinity) - (a.relativeReturn ?? -Infinity)) : model.holdings;

  useEffect(() => {
    if (!selectedKey) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedKey(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedKey]);
  useEffect(() => {
    if (!selectedKey && previousSelected.current) {
      const buttons = window.matchMedia("(min-width: 1280px)").matches ? desktopButtons.current : mobileButtons.current;
      buttons.get(previousSelected.current)?.focus();
    }
    previousSelected.current = selectedKey;
  }, [selectedKey]);

  function chooseBenchmark(id: BenchmarkId) {
    const params = new URLSearchParams({ benchmark: id });
    if (portfolioId) params.set("portfolio", portfolioId);
    router.replace(`/portfolio/map?${params}`, { scroll: false });
  }

  return <section aria-label="Portfolio Map" className="min-w-0 overflow-hidden rounded-md bg-[#171b20] text-white">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-8"><div><p className="text-xs font-medium uppercase text-[#a8b2bd]">Current holdings</p><p className="mt-1 text-xl font-medium tabular-nums">{money(model.totalValue)}</p></div><div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs text-[#a8b2bd]">Compare <select aria-label="Comparison benchmark" value={model.benchmarkId} onChange={(event) => chooseBenchmark(event.target.value as BenchmarkId)} className="rounded border border-white/20 bg-[#252b32] px-2 py-1.5 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8da9f1]">{benchmarkOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><span className="text-xs text-[#a8b2bd]">{model.holdings.length} investments</span></div></div>
    <div className="flex items-center justify-center gap-1 border-b border-white/10 px-3 py-2 xl:hidden" role="group" aria-label="Portfolio Map mobile mode">{modes.map((item) => <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => { setMode(item.id); setSelectedKey(null); setFocusedKey(null); }} className={cn("rounded px-3 py-2 text-xs text-[#a8b2bd] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8da9f1]", mode === item.id && "bg-[#303a47] text-white")}>{item.label}</button>)}</div>
    {!model.holdings.length ? <div className="flex min-h-80 items-center justify-center px-5 text-center text-sm text-[#a8b2bd]">No current holdings to map.</div> : selected ? <DecisionMap key={selected.key} holding={selected} benchmarkLabel={model.benchmarkLabel} compare={compare} onCompare={setCompare} onBack={() => setSelectedKey(null)} /> : <>
      <div className="relative hidden aspect-[2/1] min-w-0 w-full xl:block" onMouseLeave={() => setFocusedKey(null)}>
        {mode === "sectors" ? sectors.labels.map((label) => <span key={label.sector} aria-hidden="true" className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-2xl font-medium uppercase text-white/[.08]" style={{ left: `${label.x / MAP_WIDTH * 100}%`, top: `${label.y / MAP_HEIGHT * 100}%` }}>{label.sector}</span>) : null}
        {mode === "performance" ? <div aria-hidden="true" className="pointer-events-none absolute inset-x-[8%] inset-y-[8%]"><div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-white/30" /><span className="absolute left-1 top-2 text-[11px] text-[#a8b2bd]">Outperformance vs {model.benchmarkLabel}</span><span className="absolute left-1 top-[52%] text-[11px] text-[#a8b2bd]">0 pp</span><span className="absolute bottom-3 left-1 text-[11px] text-[#a8b2bd]">Underperformance</span><span className="absolute bottom-3 right-1 text-[11px] text-[#a8b2bd]">Higher portfolio weight to the right</span></div> : null}
        {model.holdings.map((holding) => {
          const position = byKey.get(holding.key);
          if (!position) return null;
          const color = mode === "performance" ? tone(holding.relativeReturn) : "#72869c";
          return <button key={holding.key} ref={(node) => { if (node) desktopButtons.current.set(holding.key, node); else desktopButtons.current.delete(holding.key); }} type="button" aria-label={`${holding.name}, ${percent(holding.weight)} portfolio weight, ${money(holding.value, holding.currency)} market value`} onFocus={() => setFocusedKey(holding.key)} onBlur={() => setFocusedKey(null)} onMouseEnter={() => setFocusedKey(holding.key)} onClick={() => setSelectedKey(holding.key)} className="absolute z-10 flex aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-[#29323c] text-xs font-medium tracking-normal text-white shadow-[0_10px_24px_#0006] transition-[left,top,width,border-color,background-color] duration-300 ease-out hover:z-20 hover:bg-[#354252] focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8da9f1] motion-reduce:transition-none" style={{ left: `${position.x / MAP_WIDTH * 100}%`, top: `${position.y / MAP_HEIGHT * 100}%`, width: `${position.radius * 2 / MAP_WIDTH * 100}%`, borderColor: color }} title={holding.name}>{holding.monogram}</button>;
        })}
      </div>
      <div className="grid gap-2 p-4 xl:hidden">{mobileRows.map((holding, index) => <div key={holding.key}>{mode === "sectors" && (index === 0 || mobileRows[index - 1].sector !== holding.sector) ? <p className="px-2 pb-2 pt-3 text-xs font-medium uppercase text-[#a8b2bd]">{holding.sector}</p> : null}<button ref={(node) => { if (node) mobileButtons.current.set(holding.key, node); else mobileButtons.current.delete(holding.key); }} type="button" onClick={() => setSelectedKey(holding.key)} className="flex w-full items-center justify-between gap-3 border-b border-white/10 px-2 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8da9f1]"><span className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#72869c] bg-[#29323c] text-xs">{holding.monogram}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{holding.name}</span><span className="text-xs text-[#a8b2bd]">{mode === "performance" ? `Vs ${model.benchmarkLabel}` : holding.sector}</span></span></span><span className="shrink-0 text-sm tabular-nums">{mode === "performance" ? percentagePoints(holding.relativeReturn) : percent(holding.weight)}</span></button></div>)}</div>
      <div className="border-t border-white/10 px-5 py-5 sm:px-8"><HoldingDetails holding={focused} benchmarkLabel={model.benchmarkLabel} /></div>
      {unplaced.length ? <p className="px-5 pb-3 text-xs text-[#c1a48b]">{unplaced.length} holdings could not fit on the canvas; all remain available in the list below.</p> : null}
      {unplaced.length ? <div className="flex flex-wrap gap-2 px-5 pb-5">{unplaced.map((holding) => <button key={holding.key} type="button" onClick={() => setSelectedKey(holding.key)} className="rounded border border-white/20 px-2 py-1 text-xs">{holding.name}</button>)}</div> : null}
      {!model.weightsAvailable ? <p className="px-5 pb-4 text-xs text-[#c1a48b]">Portfolio weights are unavailable until every open holding has a current EUR price. Circle sizes are neutral placeholders.</p> : null}
      {mode === "sectors" && !hasClassification ? <p className="px-5 pb-4 text-xs text-[#c1a48b]">Sector metadata is not stored for these holdings; they remain Unclassified.</p> : null}
      {mode === "performance" && !performance.hasScores ? <p className="px-5 pb-4 text-xs text-[#c1a48b]">Benchmark-relative returns are unavailable for the selected reference. No comparison is inferred.</p> : null}
      {mode === "performance" && performance.hasScores ? <p className="px-5 pb-4 text-xs text-[#a8b2bd]">Vertical position shows total-return difference in percentage points; horizontal position follows portfolio weight. Circles separate slightly to avoid overlap. Unavailable comparisons occupy the lower rail.</p> : null}
      {model.benchmarkError ? <p className="px-5 pb-4 text-xs text-[#c1a48b]">{model.benchmarkError}</p> : null}
    </>}
    <div className="hidden flex-wrap items-center justify-center gap-1 border-t border-white/10 px-4 py-3 xl:flex" role="group" aria-label="Portfolio Map mode">{modes.map((item) => <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => { setMode(item.id); setSelectedKey(null); setFocusedKey(null); }} className={cn("rounded px-4 py-2 text-sm text-[#a8b2bd] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8da9f1]", mode === item.id && "bg-[#303a47] text-white")}>{item.label}</button>)}</div>
  </section>;
}
