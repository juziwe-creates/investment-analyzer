import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const benchmarkIds = new Set(["msci-world", "sp-500", "dax"]);
const germanExchanges = /\.(XETRA|F|BE|DU|HM|HA|MU|STU)$/i;

export function validDate(date) {
  if (!datePattern.test(date ?? "") || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error("Invalid history date");
  return date;
}

export function validatePrices(rows, from, to) {
  if (!Array.isArray(rows) || !rows.length) throw new Error("Empty price history; existing data will be retained");
  const seen = new Set();
  for (const row of rows) {
    validDate(row.date);
    if (row.date < from || row.date > to || seen.has(row.date) || !Number.isFinite(Number(row.close)) || Number(row.close) <= 0) throw new Error("Invalid, duplicate or out-of-range price observation");
    seen.add(row.date);
  }
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

export function parseSplits(rows, from, to) {
  if (!Array.isArray(rows)) throw new Error("Invalid split history");
  const seen = new Set();
  return rows.map((row) => {
    validDate(row.date);
    const match = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(row.split ?? "");
    const numerator = Number(match?.[1]), denominator = Number(match?.[2]);
    const factor = numerator / denominator;
    if (!(numerator > 0 && denominator > 0 && Number.isFinite(factor)) || seen.has(row.date) || row.date < from || row.date > to) throw new Error("Invalid or conflicting split event");
    // This feed also includes spin-off price adjustments. Those need a broker
    // corporate-action document, not a guessed multiplication of owned shares.
    if (!Number.isInteger(factor) && !Number.isInteger(1 / factor) && factor !== 1.5) throw new Error(`Corporate-action review required for ${row.date}: ${row.split}`);
    seen.add(row.date);
    return { split_date: row.date, numerator, denominator };
  });
}

export function validateCoverage(prices, splits, firstPurchase, lastTransaction) {
  if (prices[0].date > firstPurchase || Date.parse(lastTransaction) - Date.parse(prices.at(-1).date) > 7 * 86400000) throw new Error("Downloaded prices do not cover the transaction history; existing rows will be retained");
  for (let index = 1; index < prices.length; index++) {
    const previous = prices[index - 1], current = prices[index];
    const factor = splits.filter((split) => split.split_date > previous.date && split.split_date <= current.date)
      .reduce((value, split) => value * split.numerator / split.denominator, 1);
    const movement = Number(current.close) / (Number(previous.close) / factor);
    if (movement < 0.4 || movement > 2.5) throw new Error(`Price/corporate-action review required at ${current.date}; no automatic replacement`);
  }
}

export function benchmarkRows(config, prices, fx = []) {
  if (!benchmarkIds.has(config.id) || config.confirmed !== true || !config.symbol || !["EUR", "USD"].includes(config.sourceCurrency)
      || !["price_index", "net_total_return", "gross_total_return", "total_return", "performance_index"].includes(config.seriesType)) throw new Error("Confirmed benchmark symbol, currency and return methodology are required");
  let index = 0;
  const rates = [...fx].sort((a, b) => a.date.localeCompare(b.date));
  return prices.map((row) => {
    while (index + 1 < rates.length && rates[index + 1].date <= row.date) index++;
    const rate = rates[index];
    if (config.sourceCurrency === "USD" && (!rate || rate.date > row.date || !Number.isFinite(Number(rate.close)) || Number(rate.close) <= 0
      || Date.parse(row.date) - Date.parse(rate.date) > 7 * 86400000)) throw new Error("Dated EUR/USD conversion history is incomplete");
    return { benchmark_id: config.id, benchmark_name: { "msci-world": "MSCI World", "sp-500": "S&P 500", dax: "DAX" }[config.id],
      price_date: row.date, observation_date: row.date, close_price: Number(row.close) / (config.sourceCurrency === "USD" ? Number(rate.close) : 1),
      currency: "EUR", frequency: "daily", series_type: config.seriesType, is_derived: config.sourceCurrency !== "EUR", is_partial_period: false,
      provider: "eodhd", provider_symbol: config.symbol, source_type: "api",
      source_notes: config.sourceCurrency === "USD" ? "USD index converted using prior-or-same-date EURUSD.FOREX close; no dividend adjustment added" : "EUR index raw close; return methodology explicitly confirmed" };
  });
}

export function canonicalSecurities(transactions) {
  const grouped = new Map();
  for (const row of [...transactions].sort((a, b) => a.trade_date.localeCompare(b.trade_date) || a.created_at.localeCompare(b.created_at))) {
    const key = row.isin ?? row.ticker ?? row.security_name;
    const current = grouped.get(key);
    grouped.set(key, { ...current, user_id: row.user_id, portfolio_id: row.portfolio_id, security_key: key,
      security_name: row.security_name, isin: row.isin ?? current?.isin ?? null, ticker: row.ticker ?? current?.ticker ?? null,
      security_currency: row.security_currency ?? current?.security_currency ?? null, asset_type: row.asset_type ?? current?.asset_type ?? null });
  }
  return [...grouped.values()];
}

export function resolveBackfillSymbol(security, stored, latest, catalogue) {
  const matches = catalogue.filter((row) => row.Isin === security.isin?.trim() && row.Currency === "EUR" && ["XETRA", "F"].includes(row.Exchange));
  const eligible = matches.filter((row) => !/warrant|certificate|bond/i.test(row.Type ?? ""));
  const xetra = eligible.filter((row) => row.Exchange === "XETRA");
  const exact = xetra.length ? xetra : eligible;
  const preferred = stored?.trim();
  if (preferred && germanExchanges.test(preferred)) {
    const entry = catalogue.find((row) => `${row.Code}.${row.Exchange}` === preferred);
    if ((!catalogue.length || entry) && (!entry?.Isin || !security.isin || entry.Isin === security.isin.trim())) return preferred;
  }
  if (exact.length === 1) return `${exact[0].Code}.${exact[0].Exchange}`;
  if (latest && germanExchanges.test(latest)) {
    const entry = catalogue.find((row) => `${row.Code}.${row.Exchange}` === latest);
    if ((!catalogue.length || entry) && (!entry?.Isin || !security.isin || entry.Isin === security.isin.trim())) return latest;
  }
  return null;
}

async function allRows(db, table, filters) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    let query = db.from(table).select("*").range(offset, offset + 999);
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    // Every table queried here has an id except shared benchmark history.
    query = query.order(table === "benchmark_prices" ? "price_date" : table === "user_securities" ? "security_key" : "id");
    const { data, error } = await query;
    if (error) throw new Error(`Unable to read ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const fingerprint = (rows) => createHash("sha256").update(JSON.stringify(rows)).digest("hex");
const json = async (path, value) => writeFile(path, JSON.stringify(value, null, 2), { mode: 0o600 });
const load = async (path) => JSON.parse(await readFile(path, "utf8"));

export async function main(args = process.argv.slice(2)) {
  const option = (name) => { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1]; };
  const mode = args[0] ?? "plan";
  if (!["plan", "download", "apply"].includes(mode)) throw new Error("Use plan, download, or apply");
  const portfolioId = option("--portfolio");
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId ?? "")) throw new Error("An explicit --portfolio UUID is required");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the local environment");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const directory = resolve(".market-backfill", portfolioId);
  await mkdir(directory, { recursive: true });
  const { data: portfolio, error } = await db.from("portfolios").select("id,user_id").eq("id", portfolioId).single();
  if (error || !portfolio) throw new Error("Portfolio could not be loaded");
  const filters = { user_id: portfolio.user_id, portfolio_id: portfolioId };
  const transactions = await allRows(db, "transactions", filters);
  const securities = canonicalSecurities(transactions);
  const symbols = await allRows(db, "security_provider_symbols", { ...filters, provider: "eodhd" });
  const latestPrices = await allRows(db, "latest_provider_market_prices", { ...filters, provider: "eodhd" });
  const catalogue = option("--catalogue") ? await load(resolve(option("--catalogue"))) : [];
  const today = new Date().toISOString().slice(0, 10);
  const candidates = securities.map((security) => {
    const purchases = transactions.filter((row) => row.type === "buy" && (row.isin ?? row.ticker ?? row.security_name) === security.security_key);
    const first = purchases.map((row) => row.trade_date).sort()[0];
    const stored = symbols.find((row) => row.security_key === security.security_key)?.provider_symbol;
    const latest = latestPrices.find((row) => row.security_key === security.security_key)?.provider_symbol;
    const symbol = resolveBackfillSymbol(security, stored, latest, catalogue);
    return { security, symbol, from: first ? new Date(Date.parse(first) - 7 * 86400000).toISOString().slice(0, 10) : null, to: today,
      skip: !first ? "No purchase history" : !symbol ? "Missing unambiguous EUR listing or instrument identity needs review" : null };
  });
  if (option("--security")) candidates.splice(0, candidates.length, ...candidates.filter((row) => row.security.security_key === option("--security")));
  if (option("--symbol")) {
    if (!option("--security") || candidates.length !== 1) throw new Error("A symbol override requires one explicit security");
    const entry = catalogue.find((row) => `${row.Code}.${row.Exchange}` === option("--symbol") && row.Currency === "EUR" && row.Isin === candidates[0].security.isin?.trim());
    if (!entry || !germanExchanges.test(option("--symbol"))) throw new Error("The symbol override must have an exact ISIN/EUR match in the provider catalogue");
    candidates[0].symbol = option("--symbol");
    if (candidates[0].from) candidates[0].skip = null;
  }
  if (args.includes("--only-benchmarks")) candidates.splice(0);
  const benchmarkConfig = option("--benchmarks") ? (await load(resolve(option("--benchmarks")))).benchmarks : [];
  const minimumDate = transactions.filter((row) => row.type === "buy").map((row) => row.trade_date).sort()[0];
  if (!minimumDate) throw new Error("No purchase history");
  const from = new Date(Date.parse(minimumDate) - 7 * 86400000).toISOString().slice(0, 10);
  const plan = { portfolioId, fingerprint: fingerprint(transactions), securities: candidates.map((row) => ({ security: row.security.security_name, key: row.security.security_key, symbol: row.symbol, from: row.from, to: today, skip: row.skip })), benchmarks: benchmarkConfig,
    estimatedCalls: candidates.filter((row) => !row.skip).length * 3 + benchmarkConfig.filter((row) => row.confirmed).length + (benchmarkConfig.some((row) => row.sourceCurrency === "USD") ? 1 : 0) };
  if (mode === "plan") { await json(resolve(directory, "plan.json"), plan); console.log(JSON.stringify(plan, null, 2)); return; }
  const apiToken = process.env.EODHD_API_TOKEN ?? process.env.MARKET_DATA_API_KEY;
  let calls = 0;
  const limit = Number(option("--max-calls") ?? 200);
  if (!Number.isInteger(limit) || limit < 1) throw new Error("--max-calls must be a positive integer");
  const fetchData = async (path, start, end) => {
    if (!apiToken) throw new Error("EODHD_API_TOKEN is required for download");
    if (calls >= limit) throw new Error("Configured API-call limit reached; staged downloads remain available");
    if (calls) await new Promise((done) => setTimeout(done, 1200));
    calls++;
    const endpoint = new URL(`https://eodhd.com/api/${path}`);
    endpoint.search = new URLSearchParams({ api_token: apiToken, fmt: "json", from: start, to: end, period: "d", order: "a" }).toString();
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`EODHD status ${response.status}; run stopped after ${calls} calls`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("EODHD returned an unexpected response");
    return data;
  };
  const report = [];
  const reportScope = args.includes("--only-benchmarks") ? "-benchmarks" : option("--security") ? `-${createHash("sha256").update(option("--security")).digest("hex").slice(0, 12)}` : "";
  const reportPath = resolve(directory, `${mode}${reportScope}-report.json`);
  for (const candidate of candidates) {
    const { security, symbol, skip, from: start, to } = candidate;
    if (skip) { report.push({ key: security.security_key, status: "skipped", reason: skip }); console.log(`Skipped ${security.security_name}: ${skip}`); continue; }
    try {
    const path = resolve(directory, `${createHash("sha256").update(security.security_key).digest("hex")}.json`);
    if (mode === "download") {
      let previous;
      try { previous = await load(path); } catch (error) { if (error.code !== "ENOENT") throw error; }
      if (!args.includes("--force") && previous?.transactionFingerprint === plan.fingerprint && previous?.to === to
        && previous?.prices?.[0]?.provider_symbol === symbol) {
        console.log(`Already staged ${security.security_name}; no API calls`);
        report.push({ key: security.security_key, status: "cached", prices: previous.prices.length });
        continue;
      }
      const raw = validatePrices(await fetchData(`eod/${encodeURIComponent(symbol)}`, start, to), start, to);
      const source = transactions.filter((row) => (row.isin ?? row.ticker ?? row.security_name) === security.security_key);
      const firstPurchase = source.filter((row) => row.type === "buy").map((row) => row.trade_date).sort()[0];
      const splits = parseSplits(await fetchData(`splits/${encodeURIComponent(symbol)}`, firstPurchase, to), firstPurchase, to);
      const lastTransaction = source.map((row) => row.trade_date).sort().at(-1);
      validateCoverage(raw, splits, firstPurchase, lastTransaction);
      const dividends = await fetchData(`div/${encodeURIComponent(symbol)}`, start, to);
      const base = { ...filters, security_key: security.security_key, security_name: security.security_name, isin: security.isin, ticker: security.ticker, provider: "eodhd", provider_symbol: symbol };
      const prices = raw.map((row) => ({ ...base, price_date: row.date, close_price: Number(row.close), open_price: row.open, high_price: row.high, low_price: row.low, adjusted_close_price: row.adjusted_close, volume: row.volume, currency: "EUR" }));
      const dividendRows = dividends.map((row) => {
        validDate(row.date);
        const amount = Number(row.unadjustedValue ?? row.value);
        if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(row.currency ?? "")) throw new Error("Dividend amount or native currency needs review");
        return { ...base, ex_dividend_date: row.date, declaration_date: row.declarationDate || null, record_date: row.recordDate || null, payment_date: row.paymentDate || null, amount_per_share: amount, currency: row.currency };
      });
      const splitRows = splits.map((row) => ({ ...filters, security_key: security.security_key, provider: "eodhd", provider_symbol: symbol, ...row }));
      await json(path, { portfolioId, key: security.security_key, transactionFingerprint: plan.fingerprint, from: start, to, firstPurchase, lastTransaction, prices, dividends: dividendRows, splits: splitRows });
      console.log(`Staged ${security.security_name}: ${prices.length} prices, ${splits.length} splits, ${dividends.length} dividends; first price ${raw[0].date}`);
      report.push({ key: security.security_key, status: "staged", prices: prices.length, splits: splits.length });
      continue;
    }
    const staged = await load(path);
    if (staged.portfolioId !== portfolioId || staged.key !== security.security_key || staged.transactionFingerprint !== plan.fingerprint
      || staged.prices.some((row) => row.provider_symbol !== symbol)) throw new Error("Portfolio, symbol or transaction history changed; download again");
    const raw = validatePrices(staged.prices.map((row) => ({ date: row.price_date, close: row.close_price })), staged.from, staged.to);
    validateCoverage(raw, staged.splits, staged.firstPurchase, staged.lastTransaction);
    const backup = {};
    for (const table of ["market_prices", "market_dividends", "market_splits"]) backup[table] = await allRows(db, table, { ...filters, security_key: security.security_key });
    await json(`${path}.backup-${Date.now()}`, backup);
    const { error: replaceError } = await db.rpc("replace_security_market_history", {
      p_user_id: portfolio.user_id, p_portfolio_id: portfolioId, p_security_key: security.security_key,
      p_prices: staged.prices, p_dividends: staged.dividends, p_splits: staged.splits
    });
    if (replaceError) throw new Error(`Replacement rolled back: ${replaceError.message}`);
    const { error: mappingError } = await db.from("security_provider_symbols").upsert({
      ...filters, security_key: security.security_key, provider: "eodhd", provider_symbol: symbol,
      source: "api_search", notes: symbols.find((row) => row.security_key === security.security_key)?.notes ?? "EUR listing verified for historical reload",
      resolved_at: new Date().toISOString()
    }, { onConflict: "user_id,portfolio_id,security_key,provider" });
    if (mappingError) throw new Error(`History replaced, but provider mapping could not be saved: ${mappingError.message}`);
    console.log(`Replaced ${security.security_name}: ${staged.prices.length} prices; previous rows backed up`);
    report.push({ key: security.security_key, status: "replaced", prices: staged.prices.length, splits: staged.splits.length });
    } catch (error) {
      const reason = error.code === "ENOENT" ? "No validated staged history; existing rows retained" : error.message;
      report.push({ key: security.security_key, status: "needs_review", reason });
      await json(reportPath, { mode, calls, securities: report });
      console.log(`Review ${security.security_name}: ${reason}`);
      if (/EODHD status (401|402|403|429)|Configured API-call limit reached|EODHD returned an unexpected response/.test(reason) || (mode === "apply" && error.code !== "ENOENT")) throw error;
    }
  }
  await json(reportPath, { mode, calls, securities: report });
  const benchmarkFields = ["benchmark_id", "benchmark_name", "price_date", "observation_date", "close_price", "currency", "frequency", "series_type", "is_derived", "is_partial_period", "provider", "provider_symbol", "source_type", "source_notes"];
  let fx;
  for (const config of benchmarkConfig) {
    if (!config.confirmed) { console.log(`Benchmark ${config.id}: mapping needs confirmation; retained existing history`); continue; }
    if (!benchmarkIds.has(config.id)) throw new Error("Unsupported benchmark ID");
    const existing = await allRows(db, "benchmark_prices", { benchmark_id: config.id });
    if (existing.some((row) => benchmarkFields.some((field) => !(field in row)))) throw new Error("Existing benchmark schema differs from the documented schema");
    if (existing.some((row) => row.series_type !== config.seriesType)) throw new Error(`Return methodology differs for ${config.id}; confirm the mapping before replacing history`);
    const path = resolve(directory, `benchmark-${config.id}.json`);
    if (mode === "download") {
      let previous;
      try { previous = await load(path); } catch (error) { if (error.code !== "ENOENT") throw error; }
      if (!args.includes("--force") && previous?.transactionFingerprint === plan.fingerprint
        && JSON.stringify(previous?.config) === JSON.stringify(config) && previous?.to === today) {
        console.log(`Already staged ${config.id}; no API calls`);
        continue;
      }
      const raw = validatePrices(await fetchData(`eod/${encodeURIComponent(config.symbol)}`, from, today), from, today);
      if (raw[0].date > minimumDate) throw new Error(`Benchmark ${config.id} does not cover the first investment date; existing history retained`);
      if (config.sourceCurrency === "USD") fx ??= validatePrices(await fetchData("eod/EURUSD.FOREX", from, today), from, today);
      const rows = benchmarkRows(config, raw, fx);
      await json(path, { config, rows, from, to: today, portfolioId, transactionFingerprint: plan.fingerprint });
      console.log(`Staged ${config.id}: ${rows.length} daily EUR observations`);
    } else {
      const staged = await load(path);
      if (staged.portfolioId !== portfolioId || staged.transactionFingerprint !== plan.fingerprint || JSON.stringify(staged.config) !== JSON.stringify(config)) throw new Error("Benchmark staging scope or configuration changed");
      await json(`${path}.backup-${Date.now()}`, existing);
      const { error: replaceError } = await db.rpc("replace_benchmark_history", { p_benchmark_id: config.id, p_rows: staged.rows });
      if (replaceError) throw new Error(`Benchmark replacement rolled back: ${replaceError.message}`);
      console.log(`Replaced ${config.id}: ${staged.rows.length} observations`);
    }
  }
  console.log(`Finished ${mode}; ${calls} EODHD calls. Transactions and personal dividends were preserved.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
