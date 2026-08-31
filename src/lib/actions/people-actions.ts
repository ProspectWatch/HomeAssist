"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import { validatePersonName } from "@/lib/household/people";

const TOUCHED = ["/settings", "/receipts", "/shop/list", "/home"];

function revalidateAll() {
  for (const path of TOUCHED) revalidatePath(path);
}

export async function addHouseholdPerson(name: string, isChild: boolean): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { data: existing } = await supabase
      .from("household_people")
      .select("name")
      .eq("household_id", householdId);

    const check = validatePersonName(
      name,
      ((existing ?? []) as { name: string }[]).map((r) => r.name),
    );
    if (!check.ok) return { ok: false, message: check.message };

    const { error } = await supabase
      .from("household_people")
      .insert({ household_id: householdId, name: check.name, is_child: isChild });
    if (error) {
      // The unique index is the real guard; the check above is only for a
      // readable message when we already know the answer.
      return {
        ok: false,
        message: error.code === "23505" ? `${check.name} is already in the household.` : error.message,
      };
    }

    revalidateAll();
    return { ok: true };
  });
}

export async function removeHouseholdPerson(personId: string): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    // Attribution columns are ON DELETE SET NULL, so removing someone leaves
    // their purchase history intact and simply unattributed — never deletes
    // what the household actually bought.
    const { error } = await supabase
      .from("household_people")
      .delete()
      .eq("id", personId)
      .eq("household_id", householdId);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true };
  });
}

/** Assigns (or clears) who a receipt line was for. */
export async function setReceiptLinePerson(
  receiptId: string,
  lineId: string,
  personId: string | null,
): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { data: receipt } = await supabase
      .from("receipts")
      .select("id")
      .eq("id", receiptId)
      .eq("household_id", householdId)
      .maybeSingle();
    if (!receipt) return { ok: false, message: "Receipt not found." };

    const { error } = await supabase
      .from("receipt_items")
      .update({ person_id: personId })
      .eq("id", lineId)
      .eq("receipt_id", receiptId);
    if (error) return { ok: false, message: error.message };

    // A verified receipt has already written purchase history, so the
    // attribution has to follow through to it rather than only living on the
    // receipt line.
    await supabase
      .from("household_purchases")
      .update({ person_id: personId })
      .eq("receipt_item_id", lineId)
      .eq("household_id", householdId);

    revalidatePath(`/receipts/${receiptId}`);
    return { ok: true };
  });
}

/**
 * Records what a person can't have and won't eat.
 *
 * Stored as lists rather than a note so the planner can match them against
 * ingredient names. Entries are trimmed and de-duplicated case-insensitively —
 * "Peanut" and "peanut" are one allergen, and a list that shows both invites
 * someone to remove the wrong one.
 */
export async function setPersonDietary(
  personId: string,
  dietary: { allergies: string[]; dislikes: string[] },
): Promise<ActionResult> {
  const clean = (values: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of values) {
      const value = raw.trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
    return out;
  };

  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase
      .from("household_people")
      .update({ allergies: clean(dietary.allergies), dislikes: clean(dietary.dislikes) })
      .eq("id", personId)
      .eq("household_id", householdId);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    revalidatePath("/shop/recipes");
    return { ok: true };
  });
}
