import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { buildUniverseHistory, type UniverseHistory } from "./history";
import { eurAggregationStatus } from "../analytics/currency";

// Exercise the real server-action orchestration without network, cookies or credentials.
const source = readFileSync("app/(app)/analytics/actions.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
type Action = (portfolio: string | undefined, presentation: boolean) => Promise<{ history: UniverseHistory | null; error: string | null }>;

function harness(options: { authenticated?: boolean; presenting?: boolean; accountAllowed?: boolean; readFailure?: boolean; throwRead?: boolean } = {}) {
  const calls: string[] = [];
  const transaction = { id: "buy", type: "buy", trade_date: "2020-01-01", security_name: "Scaled example", isin: "A", ticker: null,
    quantity: 20, unit_price: 10, gross_amount: 200, net_amount: null, currency: "EUR", created_at: "2020-01-01" };
  const query = {
    select() { return query; },
    eq(field: string, value: string) { calls.push(`account:${field}:${value}`); return query; },
    async single() { return options.accountAllowed === false ? { data: null, error: {} } : { data: { id: "mine" }, error: null }; }
  };
  const modules: Record<string, unknown> = {
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => {
      calls.push("auth"); return { data: { user: options.authenticated === false ? null : { id: "user" } } };
    } }, from: () => query }) },
    "@/lib/presentation": {
      presentationEnabled: async () => { calls.push("presentation"); return options.presenting ?? false; },
      presentationTransactions: async (portfolio?: string) => {
        calls.push(`transactions:${portfolio}`);
        if (options.throwRead) throw new Error("private database details");
        return { data: [transaction, { ...transaction, id: "future", trade_date: "9999-01-01" }], error: null };
      }
    },
    "@/lib/market-data/history": { readMarketHistory: async (portfolio?: string) => {
      calls.push(`prices:${portfolio}`);
      return { data: [{ security_key: "A", price: 15, price_date: "2020-01-01", currency: "EUR" },
        { security_key: "unowned", price: 999, price_date: "2020-01-01", currency: "USD" }], error: options.readFailure ? {} : null };
    } },
    "@/lib/analytics/portfolio": { toAnalyticsPrices: (rows: unknown) => rows },
    "@/lib/analytics/currency": { eurAggregationStatus },
    "@/lib/analytics-3d/history": { buildUniverseHistory }
  };
  const exports: { loadUniverseHistory?: Action } = {};
  runInNewContext(compiled, { exports, require: (name: string) => {
    if (!(name in modules)) throw new Error(`Unmocked import: ${name}`);
    return modules[name];
  } });
  return { action: exports.loadUniverseHistory!, calls };
}

test("history action rejects unauthenticated requests before any financial read", async () => {
  const { action, calls } = harness({ authenticated: false });
  const result = await action(undefined, false);
  assert.equal(result.history, null);
  assert.ok(result.error);
  assert.deepEqual(calls, ["auth"]);
});
test("history action rejects stale presentation state in both directions", async () => {
  for (const presenting of [false, true]) {
    const { action, calls } = harness({ presenting });
    const result = await action("mine", !presenting);
    assert.equal(result.history, null);
    assert.match(result.error!, /Presentation settings changed/);
    assert.deepEqual(calls, ["auth", "presentation"]);
  }
});
test("history action checks account access before loading transactions or prices", async () => {
  const { action, calls } = harness({ accountAllowed: false });
  assert.equal((await action("other-account", false)).history, null);
  assert.deepEqual(calls, ["auth", "presentation", "account:id:other-account"]);
});
test("history action scopes reads, preserves scaled inputs and filters future/unowned records", async () => {
  const { action, calls } = harness({ presenting: true });
  const result = await action("mine", true);
  assert.equal(result.error, null);
  assert.equal(result.history!.snapshots.at(-1)!.value, 300);
  assert.equal(result.history!.snapshots.at(-1)!.states[0][1], 20);
  assert.equal(result.history!.catalog.length, 1);
  assert.equal(result.history!.catalog[0].href, "/portfolio/A?portfolio=mine");
  assert.deepEqual(calls, ["auth", "presentation", "account:id:mine", "transactions:mine", "prices:mine"]);
});
test("history action fails closed on read errors without disclosing internal details", async () => {
  for (const options of [{ readFailure: true }, { throwRead: true }]) {
    const { action } = harness(options);
    const result = await action(undefined, false);
    assert.equal(result.history, null);
    assert.match(result.error!, /could not be loaded/);
    assert.ok(!result.error!.includes("private database"));
  }
});
