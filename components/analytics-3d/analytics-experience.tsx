"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowRight, Expand, Info, Minimize, RotateCcw, X } from "lucide-react";
import { AlphaProgress } from "@/components/alpha-progress";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";
import type { UniverseModel } from "@/lib/analytics-3d/model";
import type { UniverseHistory } from "@/lib/analytics-3d/history";
import { usePlayback } from "./use-playback";
import { AnalyticsTimeline } from "./analytics-timeline";
import styles from "./analytics.module.css";

const Scene = dynamic(() => import("./analytics-scene"), { ssr: false, loading: () => <div className={styles.loading}><AlphaProgress status="Preparing portfolio universe" size="large" /></div> });
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function useMedia(query: string) {
  return useSyncExternalStore((notify) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  }, () => window.matchMedia(query).matches, serverReady);
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function AnalyticsExperience({ model: currentModel, portfolio, initialHistory }: { model: UniverseModel; portfolio?: string; initialHistory?: UniverseHistory }) {
  const playback = usePlayback(currentModel, portfolio, initialHistory);
  const model = playback.model;
  const [mode, setMode] = useState<"core" | "universe">("core");
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [info, setInfo] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [reset, setReset] = useState(0);
  const [contextLost, setContextLost] = useState(false);
  const wrapper = useRef<HTMLElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const selector = useRef<HTMLSelectElement>(null);
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const small = useMedia("(max-width: 639px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const holding = model.holdings.find((item) => item.key === selected);
  // A sold position must not silently become selected again on a later replay.
  if (selected && !holding) setSelected(null);
  const preview = model.holdings.find((item) => item.key === hovered);
  const sectorCount = new Set(model.holdings.map((item) => item.sector)).size;
  const fallback = <div className={styles.fallback}><p>Immersive 3D is unavailable on this device.</p><p>Your holdings remain available below.</p><Link href={model.portfolioHref}>View portfolio <ArrowRight size={16} /></Link></div>;

  useEffect(() => { if (selected) detail.current?.focus(); }, [selected]);
  useEffect(() => {
    const changed = () => setImmersive(document.fullscreenElement === wrapper.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  useEffect(() => {
    if (!immersive) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = old; };
  }, [immersive]);

  function closeDetail() { setSelected(null); selector.current?.focus(); }
  async function fullscreen() {
    if (immersive) {
      if (document.fullscreenElement === wrapper.current) await document.exitFullscreen().catch(() => {});
      setImmersive(false);
    } else {
      try { if (!wrapper.current?.requestFullscreen) throw new Error(); await wrapper.current.requestFullscreen(); }
      catch { setImmersive(true); }
    }
  }
  function changeMode(next: "core" | "universe") { setMode(next); setSelected(null); setHovered(null); }

  return <section ref={wrapper} className={`${styles.experience} ${immersive ? styles.immersive : ""}`} aria-label="Portfolio universe" onKeyDown={(event) => {
    if (event.key === "Escape") {
      setInfo(false);
      if (selected) closeDetail();
      if (immersive && !document.fullscreenElement) setImmersive(false);
    }
    // The in-page fullscreen fallback must not tab into hidden application chrome.
    if (event.key === "Tab" && immersive) {
      const items = [...(wrapper.current?.querySelectorAll<HTMLElement>("button, a[href], input, select, summary, [tabindex='0']") ?? [])]
        .filter((item) => !item.hasAttribute("disabled") && item.getClientRects().length > 0);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <header className={styles.toolbar}>
      <div><h1>αnalytics</h1><p>{model.account}</p></div>
      <div className={styles.modes} aria-label="Scene mode"><button aria-pressed={mode === "core"} onClick={() => changeMode("core")}>Core</button><button aria-pressed={mode === "universe"} onClick={() => changeMode("universe")}>Universe</button></div>
      <div className={styles.tools}><button title="How to read this" aria-label="How to read this" aria-expanded={info} onClick={() => setInfo(!info)}><Info size={18} /></button><button title={immersive ? "Exit fullscreen" : "Fullscreen"} aria-label={immersive ? "Exit fullscreen" : "Fullscreen"} onClick={fullscreen}>{immersive ? <Minimize size={18} /> : <Expand size={18} />}</button></div>
    </header>
    <div className={styles.workspace}>
      <div className={`${styles.stage} ${small && mode === "universe" && !info ? styles.compact : ""}`}>
        {!ready ? <div className={styles.loading}><AlphaProgress status="Preparing portfolio universe" /></div> : small ? <div className={styles.mobileCore} aria-hidden="true">α</div> : contextLost ? fallback : <SceneBoundary fallback={fallback}><Scene model={model} catalog={playback.cursor !== null ? playback.history?.catalog : undefined} historyMax={playback.cursor !== null ? playback.history?.maxValue : undefined} pulse={playback.pulse} mode={mode} selected={holding ? selected : null} hovered={preview ? hovered : null} reducedMotion={reduced} reset={reset} onSelect={setSelected} onHover={setHovered} onContextLost={() => setContextLost(true)} fallback={fallback} /></SceneBoundary>}
        {mode === "core" ? <div className={styles.coreInfo}><p className={styles.eyebrow}>{model.complete ? "Portfolio value" : "Priced holdings"}</p><p className={styles.value}>{formatCurrency(model.value)}</p><p>{model.holdings.length} investments · {sectorCount} {sectorCount === 1 ? "cluster" : "clusters"}</p><button className={styles.enter} onClick={() => changeMode("universe")}>Enter Universe <ArrowRight size={17} /></button></div> : <div className={styles.universeSummary}><p className={styles.eyebrow}>{model.complete ? "Portfolio value" : "Priced holdings"}</p><strong>{formatCurrency(model.value)}</strong><button aria-label="Reset universe camera" title="Reset camera" onClick={() => { setSelected(null); setReset(reset + 1); }}><RotateCcw size={16} /></button></div>}
        {preview && !selected && mode === "universe" ? <div className={styles.preview} aria-live="polite"><strong>{preview.name}</strong><span>{formatCurrency(preview.value)} · {formatPercent(preview.weight)} of portfolio</span><span>Unrealized {formatCurrency(preview.unrealizedGain)}</span></div> : null}
        {info ? <div className={styles.guide}><button title="Close guide" aria-label="Close guide" onClick={() => setInfo(false)}><X size={18} /></button><h2>How to read this</h2><p>Sphere volume follows market value, with size limits for legibility. Neutral spheres may have no price; their size is a placeholder, not zero value.</p><p>Emerald means positive unrealized gain; muted red means negative. Numbers provide the same information. Cost basis follows the existing Portfolio FIFO view.</p><p>Positions are stable within sector clusters. Unclassified investments appear in Other. Select an investment to inspect it, or use the holdings explorer.</p><p>History preserves transaction dates and monthly price snapshots. Numbers show the dated snapshot; sphere sizes ease between states. Today restores the current view, including manual quotes. History uses the same market-price series as Portfolio development.</p><p>Gold flows represent recorded dividend transactions, using recorded gross cash where available, otherwise net cash or recorded quantity times payment per share. They are not provider forecasts or a new after-tax calculation. Dense payments share a bounded visual effect. Scrubbing does not replay payments.</p></div> : null}
      </div>
      {holding ? <aside className={styles.detail} aria-label="Selected investment"><div ref={detail} tabIndex={-1}><button className={styles.close} title="Close investment" aria-label="Close investment" onClick={closeDetail}><X size={18} /></button><p className={styles.eyebrow}>{holding.sector}</p><h2>{holding.name}</h2><p className={styles.detailValue}>{formatCurrency(holding.value)}</p><dl><dt>Shares held</dt><dd>{formatNumber(holding.quantity)}</dd><dt>Portfolio weight</dt><dd>{formatPercent(holding.weight)}</dd><dt>Remaining cost basis</dt><dd>{formatCurrency(holding.costBasis)}</dd><dt>Unrealized gain</dt><dd>{formatCurrency(holding.unrealizedGain)}</dd><dt>Latest quote</dt><dd>{holding.priceDate ? formatDate(holding.priceDate) : "Unavailable"}</dd></dl>{holding.value === null ? <p>Current valuation unavailable. This holding is not valued at zero.</p> : null}<Link href={holding.href}>View Investment <ArrowRight size={16} /></Link></div></aside> : null}
    </div>
    <AnalyticsTimeline playback={playback} />
    <footer className={styles.footer}><span>{playback.cursor === null ? "Latest stored quotes" : "Historical snapshot"} · {formatDate(model.asOfDate)}</span><span>Size: value · Color: unrealized gain</span></footer>
    {model.warnings.map((warning) => <p className={styles.warning} key={warning} role="status">{warning}</p>)}
    <div className={styles.explorer}>
      {small ? <p className={styles.mobileNote}>The full 3D Universe is optimized for larger screens. Explore the same holdings here.</p> : null}
      <label htmlFor="universe-holding">Explore investments</label><select ref={selector} id="universe-holding" value={holding ? selected ?? "" : ""} onChange={(event) => { setSelected(event.target.value || null); setMode("universe"); }}><option value="">Choose investment</option>{model.holdings.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select>
      <details open={small}><summary>All holdings ({model.holdings.length})</summary><ul>{model.holdings.map((item) => <li key={item.key}><button onClick={() => { setSelected(item.key); setMode("universe"); }}><span>{item.name}<small>{item.sector}</small></span><span>{formatCurrency(item.value)}<small>Unrealized {formatCurrency(item.unrealizedGain)}</small></span></button></li>)}</ul></details>
      {!model.holdings.length ? <p>No open holdings in this account. <Link href={model.portfolioHref}>View portfolio</Link></p> : null}
    </div>
  </section>;
}
