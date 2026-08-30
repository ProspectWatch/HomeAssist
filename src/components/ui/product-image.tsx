import Image from "next/image";
import {
  Apple,
  Baby,
  Beef,
  Candy,
  Cookie,
  Croissant,
  CupSoda,
  Egg,
  Package,
  PawPrint,
  Snowflake,
  Sparkles,
  SprayCan,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Category fallbacks for products whose photo hasn't been sourced yet (see
 * docs/image-acquisition-manifest.csv). A recognisable category mark reads far
 * better on a phone than a generic box — and never implies packaging we don't
 * actually have an image of.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Produce: Apple,
  "Meat & Seafood": Beef,
  "Dairy & Eggs": Egg,
  Pantry: Wheat,
  Frozen: Snowflake,
  Drinks: CupSoda,
  Household: SprayCan,
  "Deli & Prepared": Package,
  Bakery: Croissant,
  Snacks: Cookie,
  Confectionery: Candy,
  "Health & Beauty": Sparkles,
  "Baby & Kids": Baby,
  Pet: PawPrint,
};

/**
 * Product photo slot. Per the handoff's PRODUCT IMAGE RULE: never crop
 * packaging — always object-fit: contain, on a white ground, with the
 * product occupying roughly 70–85% of the box (achieved here with ~12%
 * padding around a `fill` + `object-contain` image).
 */
export function ProductImage({
  src,
  alt,
  height,
  category,
  className,
}: {
  src: string | null;
  alt: string;
  height: number;
  category?: string | null;
  className?: string;
}) {
  const FallbackIcon = (category && CATEGORY_ICONS[category]) || Package;

  return (
    <div className={cn("relative bg-white", className)} style={{ height }}>
      {src ? (
        <div className="absolute inset-[12%]">
          <Image src={src} alt={alt} fill sizes="200px" className="object-contain" />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center bg-cream/60">
          <FallbackIcon className="h-7 w-7 text-muted2" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
