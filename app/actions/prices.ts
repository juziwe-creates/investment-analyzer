"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function requiredText(formData: FormData, key: string, label: string) {
  const value = formData.get(key)?.toString().trim();

  if (!value) {
    redirect(`/securities?message=${encodeURIComponent(`${label} is required`)}`);
  }

  return value;
}

export async function upsertManualSecurityPrice(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const securityKey = requiredText(formData, "security_key", "Security key");
  const portfolioId = requiredText(formData, "portfolio_id", "Portfolio");
  const securityName = requiredText(formData, "security_name", "Security name");
  const rawPrice = requiredText(formData, "price", "Price");
  const currency = requiredText(formData, "currency", "Currency").toUpperCase();
  const priceDate = requiredText(formData, "price_date", "Price date");
  const price = Number(rawPrice);

  if (!Number.isFinite(price) || price < 0) {
    redirect("/securities?message=Price must be a positive number");
  }

  const { error } = await supabase.from("manual_security_prices").upsert(
    {
      user_id: user.id,
      portfolio_id: portfolioId,
      security_key: securityKey,
      security_name: securityName,
      isin: formData.get("isin")?.toString() || null,
      ticker: formData.get("ticker")?.toString() || null,
      price,
      currency,
      price_date: priceDate
    },
    {
      onConflict: "user_id,portfolio_id,security_key"
    }
  );

  if (error) {
    redirect(`/securities?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/securities");
  revalidatePath("/transactions");
  redirect("/securities?message=Price saved");
}

