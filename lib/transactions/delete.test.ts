import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const source = readFileSync("app/actions/transactions.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
type Query = { table: string; mutation: boolean; filters: Record<string, string> };

function harness({ presenting = false, authenticated = true, owner = "owner", portfolioOwner = "owner", failDelete = false } = {}) {
  const queries: Query[] = [], invalidations: string[][] = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "owner" } : null }, error: null }) },
    from(table: string) {
      const query: Query = { table, mutation: false, filters: {} }; queries.push(query);
      const builder = {
        select: () => builder,
        delete: () => { query.mutation = true; return builder; },
        eq: (key: string, value: string) => { query.filters[key] = value; return builder; },
        maybeSingle: async () => {
          const owned = query.filters.user_id === (table === "portfolios" ? portfolioOwner : owner);
          const matches = table === "portfolios" ? query.filters.id === "portfolio" : query.filters.id === id && (!query.filters.portfolio_id || query.filters.portfolio_id === "portfolio");
          return { data: owned && matches && !(query.mutation && failDelete) ? { id: table === "portfolios" ? "portfolio" : id, portfolio_id: "portfolio" } : null, error: null };
        }
      };
      return builder;
    }
  };
  const actions: { deleteTransaction?: (id: string, portfolio?: string) => Promise<{ error?: string }> } = {};
  runInNewContext(compiled, { exports: actions, require: (name: string) => {
    if (name === "@/lib/presentation") return { requireActualDataMode: async () => { if (presenting) throw new Error("Presentation mode"); } };
    if (name === "@/lib/supabase/server") return { createClient: async () => db };
    if (name === "next/cache") return { revalidatePath: (...args: string[]) => invalidations.push(args) };
    if (name === "next/navigation") return { redirect: () => { throw new Error("Unexpected redirect"); } };
    throw new Error(`Unexpected module ${name}`);
  } });
  return { remove: actions.deleteTransaction!, queries, invalidations };
}

test("owner deletion is server-side, scoped twice and invalidates all derived routes without redirecting context", async () => {
  const h = harness();
  assert.equal((await h.remove(id, "portfolio")).error, undefined);
  const mutation = h.queries.filter((query) => query.mutation);
  assert.equal(mutation.length, 1);
  assert.deepEqual(mutation[0], { table: "transactions", mutation: true, filters: { id, user_id: "owner", portfolio_id: "portfolio" } });
  assert.deepEqual(h.invalidations, [["/", "layout"]]);
  assert.ok(h.queries.some((query) => query.table === "portfolios" && query.filters.user_id === "owner"));
});

test("unauthenticated, foreign transaction, foreign portfolio and wrong context cannot delete", async () => {
  for (const options of [{ authenticated: false }, { owner: "other" }, { portfolioOwner: "other" }]) {
    const h = harness(options);
    assert.ok((await h.remove(id)).error);
    assert.equal(h.queries.some((query) => query.mutation), false);
    assert.equal(h.invalidations.length, 0);
  }
  const h = harness();
  assert.ok((await h.remove(id, "different-portfolio")).error);
  assert.equal(h.queries.some((query) => query.mutation), false);
});

test("presentation blocks before database access; failed or invalid deletes never report success", async () => {
  const h = harness({ presenting: true });
  await assert.rejects(h.remove(id), /Presentation mode/);
  assert.equal(h.queries.length, 0);
  const invalid = harness();
  assert.ok((await invalid.remove("not-an-id")).error);
  assert.equal(invalid.queries.length, 0);
  const failed = harness({ failDelete: true });
  assert.ok((await failed.remove(id)).error);
  assert.equal(failed.invalidations.length, 0);
});

test("existing SQL cascades dependent components and detaches import rows without removing sources", () => {
  const schema = readFileSync("supabase/migrations/20260613000000_initial_schema.sql", "utf8");
  assert.match(schema, /create table public.transaction_components[\s\S]*?transaction_id uuid not null references public.transactions\(id\) on delete cascade/);
  assert.match(schema, /create table public.import_rows[\s\S]*?transaction_id uuid references public.transactions\(id\) on delete set null/);
  assert.doesNotMatch(source.slice(source.indexOf("export async function deleteTransaction")), /from\("(?:source_documents|import_rows|transaction_components)"\)/);
});
