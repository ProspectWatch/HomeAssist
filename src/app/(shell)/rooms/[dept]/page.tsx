import { notFound } from "next/navigation";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getDepartments } from "@/lib/data/departments";
import { getWatchItems } from "@/lib/data/watch";
import { getOwnedProducts } from "@/lib/data/owned";
import { getRegularBuys } from "@/lib/data/pantry";
import { DEPARTMENT_HERO_IMAGES } from "@/lib/assets";
import { DepartmentView } from "./department-view";

export default async function DepartmentPage({ params }: { params: Promise<{ dept: string }> }) {
  const { dept: deptKey } = await params;
  const departments = await getDepartments();
  const dept = departments.find((d) => d.key === deptKey);
  if (!dept) notFound();

  const householdId = await getCurrentHouseholdId();
  const [allWatch, ownedItems, regularBuys] = await Promise.all([
    getWatchItems(householdId),
    getOwnedProducts(householdId, deptKey),
    getRegularBuys(householdId, deptKey),
  ]);
  const watchItems = allWatch.filter((w) => w.department_key === deptKey);

  return (
    <DepartmentView
      dept={dept}
      heroSrc={DEPARTMENT_HERO_IMAGES[deptKey]}
      watchItems={watchItems}
      ownedItems={ownedItems}
      regularBuys={regularBuys}
    />
  );
}
