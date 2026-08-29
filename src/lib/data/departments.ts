import { createClient } from "@/lib/supabase/server";

export type Department = {
  key: string;
  name: string;
  hero_placeholder: string;
};

export async function getDepartments(): Promise<Department[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("departments")
      .select("key, name, hero_placeholder")
      .order("sort_order", { ascending: true });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export type DepartmentSummary = Department & {
  watchingCount: number;
  ownedCount: number;
  itemCount: number;
};

/** Departments annotated with real counts (0 today — no data yet). */
export async function getDepartmentsWithCounts(householdId: string | null): Promise<DepartmentSummary[]> {
  const departments = await getDepartments();
  if (!householdId) return departments.map((d) => ({ ...d, watchingCount: 0, ownedCount: 0, itemCount: 0 }));

  try {
    const supabase = await createClient();
    const [{ data: watch }, { data: owned }, { data: products }] = await Promise.all([
      supabase
        .from("watch_items")
        .select("product:products!inner(department_key, household_id)")
        .eq("status", "watching"),
      supabase.from("owned_products").select("department_key, household_id"),
      supabase.from("products").select("department_key, household_id").eq("is_regular_buy", true),
    ]);

    const countBy = (rows: { department_key: string | null }[] | null | undefined) => {
      const map = new Map<string, number>();
      for (const r of rows ?? []) {
        if (!r.department_key) continue;
        map.set(r.department_key, (map.get(r.department_key) ?? 0) + 1);
      }
      return map;
    };

    type WatchProductRow = { product: { department_key: string | null; household_id: string } | null };
    const watchDepts = ((watch as unknown as WatchProductRow[]) ?? [])
      .filter((r) => r.product?.household_id === householdId)
      .map((r) => ({ department_key: r.product!.department_key }));
    const watchCount = countBy(watchDepts);
    const ownedCount = countBy((owned ?? []).filter((r) => r.household_id === householdId));
    const itemCount = countBy((products ?? []).filter((r) => r.household_id === householdId));

    return departments.map((d) => ({
      ...d,
      watchingCount: watchCount.get(d.key) ?? 0,
      ownedCount: ownedCount.get(d.key) ?? 0,
      itemCount: itemCount.get(d.key) ?? 0,
    }));
  } catch {
    return departments.map((d) => ({ ...d, watchingCount: 0, ownedCount: 0, itemCount: 0 }));
  }
}
