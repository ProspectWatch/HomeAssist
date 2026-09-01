import Link from "next/link";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getDepartmentsWithCounts } from "@/lib/data/departments";
import { HeroImage } from "@/components/ui/hero-image";
import { DEPARTMENT_HERO_IMAGES } from "@/lib/assets";

function deptHref(key: string) {
  if (key === "kitchen") return "/shop/pantry";
  if (key === "sports") return "/rooms/sports";
  return `/rooms/${key}`;
}

function summaryLines(d: { itemCount: number; watchingCount: number; ownedCount: number }) {
  const lines: string[] = [];
  if (d.itemCount > 0) lines.push(`${d.itemCount} Items`);
  if (d.ownedCount > 0) lines.push(`${d.ownedCount} Owned`);
  if (d.watchingCount > 0) lines.push(`${d.watchingCount} Being Watched`);
  if (lines.length === 0) lines.push("Nothing tracked yet");
  return lines;
}

export default async function RoomsPage() {
  const householdId = await getCurrentHouseholdId();
  const departments = await getDepartmentsWithCounts(householdId);

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-3.5">
        <h1 className="font-serif text-[26px] leading-tight text-ink">Your Home</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">Every room, tracked in one place.</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 px-5">
        {departments.map((dept) => {
          const [line1, line2] = summaryLines(dept);
          return (
            <Link
              key={dept.key}
              href={deptHref(dept.key)}
              className="overflow-hidden rounded-(--radius-md) border border-line bg-white"
            >
              <HeroImage
                src={DEPARTMENT_HERO_IMAGES[dept.key]}
                alt={dept.hero_placeholder}
                height={96}
                tabletHeight={150}
                radiusClassName="rounded-none"
              />
              <div className="px-3 py-2.5">
                <div className="text-[12.5px] font-semibold tracking-[0.02em]">{dept.name}</div>
                <div className="mt-0.5 text-[11px] text-muted">{line1}</div>
                {line2 ? <div className="text-[11px] font-semibold text-oak">{line2}</div> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
