"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/helpers";

export type CreateHouseholdInput = {
  householdName: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
  preferredRetailerIds: string[];
};

async function alreadyInHousehold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("household_members")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function createHousehold(input: CreateHouseholdInput): Promise<ActionResult> {
  const name = input.householdName.trim();
  if (!name) return { ok: false, message: "Enter a household name." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session expired — sign in again." };

  if (await alreadyInHousehold(supabase, user.id)) {
    redirect("/home");
  }

  const { data: household, error: householdError } = await supabase
    .from("households")
    .insert({ name })
    .select("id")
    .single();
  if (householdError || !household) {
    return { ok: false, message: householdError?.message ?? "Couldn't create the household." };
  }

  const { error: memberError } = await supabase
    .from("household_members")
    .insert({ household_id: household.id, user_id: user.id, role: "owner" });
  if (memberError) return { ok: false, message: memberError.message };

  const { error: settingsError } = await supabase.from("household_settings").upsert({
    household_id: household.id,
    postal_code: input.postalCode.trim() || null,
    city: input.city.trim() || null,
    province: input.province.trim() || null,
    country: input.country.trim() || "Canada",
    preferred_retailer_ids: input.preferredRetailerIds,
    updated_at: new Date().toISOString(),
  });
  if (settingsError) return { ok: false, message: settingsError.message };

  redirect("/home");
}

export async function joinHousehold(joinCode: string): Promise<ActionResult> {
  const code = joinCode.trim();
  if (!code) return { ok: false, message: "Enter a join code." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session expired — sign in again." };

  if (await alreadyInHousehold(supabase, user.id)) {
    redirect("/home");
  }

  const { data: rows, error: lookupError } = await supabase.rpc("household_by_join_code", {
    code,
  });
  if (lookupError) return { ok: false, message: lookupError.message };
  const household = rows?.[0];
  if (!household) return { ok: false, message: "No household found for that code." };

  const { error: memberError } = await supabase
    .from("household_members")
    .insert({ household_id: household.id, user_id: user.id, role: "member" });
  if (memberError) return { ok: false, message: memberError.message };

  redirect("/home");
}
