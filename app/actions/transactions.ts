"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type TransactionType = Database["public"]["Enums"]["transaction_type"];

const transactionTypes = new Set<TransactionType>([
  "buy",
  "sell",
  "dividend",
  "fee",
  "tax"
]);

function optionalText(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim();
  return value ? value : null;
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = optionalText(formData, key);

  if (!value) {
    redirect(`/transactions?message=${encodeURIComponent(`${label} is required`)}`);
  }

  return value;
}

function optionalNumber(formData: FormData, key: string) {
  const value = optionalText(formData, key);

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    redirect(`/transactions?message=${encodeURIComponent(`${key} must be a number`)}`);
  }

  return parsed;
}

async function getOrCreateDefaultPortfolio(userId: string) {
  const supabase = await createClient();
  const { data: existingPortfolio, error: readError } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (readError) {
    redirect(`/transactions?message=${encodeURIComponent(readError.message)}`);
  }

  if (existingPortfolio) {
    return existingPortfolio.id;
  }

  const { data: newPortfolio, error: createError } = await supabase
    .from("portfolios")
    .insert({
      user_id: userId,
      name: "Default Portfolio"
    })
    .select("id")
    .single();

  if (createError) {
    redirect(`/transactions?message=${encodeURIComponent(createError.message)}`);
  }

  return newPortfolio.id;
}

export async function createManualTransaction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const rawType = requiredText(formData, "type", "Transaction type");

  if (!transactionTypes.has(rawType as TransactionType)) {
    redirect("/transactions?message=Unsupported transaction type");
  }

  const type = rawType as TransactionType;
  const tradeDate = requiredText(formData, "trade_date", "Trade date");
  const securityName = requiredText(formData, "security_name", "Security name");
  const currency = requiredText(formData, "currency", "Currency").toUpperCase();
  const quantity = optionalNumber(formData, "quantity");
  const unitPrice = optionalNumber(formData, "unit_price");
  const grossAmount = optionalNumber(formData, "gross_amount");
  const netAmount = optionalNumber(formData, "net_amount") ?? grossAmount;
  const fees = optionalNumber(formData, "fees");
  const taxes = optionalNumber(formData, "taxes");

  if ((type === "buy" || type === "sell") && !quantity) {
    redirect("/transactions?message=Quantity is required for buy and sell transactions");
  }

  const portfolioId = await getOrCreateDefaultPortfolio(user.id);

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      portfolio_id: portfolioId,
      type,
      trade_date: tradeDate,
      security_name: securityName,
      isin: optionalText(formData, "isin")?.toUpperCase(),
      wkn: optionalText(formData, "wkn")?.toUpperCase(),
      ticker: optionalText(formData, "ticker")?.toUpperCase(),
      exchange: optionalText(formData, "exchange"),
      security_currency: optionalText(formData, "security_currency")?.toUpperCase() ?? currency,
      asset_type: optionalText(formData, "asset_type"),
      quantity,
      unit_price: unitPrice,
      gross_amount: grossAmount,
      net_amount: netAmount,
      currency,
      broker: "manual",
      notes: optionalText(formData, "notes")
    })
    .select("id")
    .single();

  if (transactionError) {
    redirect(`/transactions?message=${encodeURIComponent(transactionError.message)}`);
  }

  const components: Database["public"]["Tables"]["transaction_components"]["Insert"][] = [];

  if (fees && fees > 0) {
    components.push({
      transaction_id: transaction.id,
      component_type: "fee",
      amount: fees,
      currency,
      description: "Manual entry fee"
    });
  }

  if (taxes && taxes > 0) {
    components.push({
      transaction_id: transaction.id,
      component_type: "tax",
      amount: taxes,
      currency,
      description: "Manual entry tax"
    });
  }

  if (components.length > 0) {
    const { error: componentsError } = await supabase
      .from("transaction_components")
      .insert(components);

    if (componentsError) {
      redirect(`/transactions?message=${encodeURIComponent(componentsError.message)}`);
    }
  }

  revalidatePath("/transactions");
  redirect("/transactions?message=Transaction saved");
}

