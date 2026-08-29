import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

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
  className,
}: {
  src: string | null;
  alt: string;
  height: number;
  className?: string;
}) {
  return (
    <div className={cn("relative bg-white", className)} style={{ height }}>
      {src ? (
        <div className="absolute inset-[12%]">
          <Image src={src} alt={alt} fill sizes="200px" className="object-contain" />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <Package className="h-6 w-6 text-muted2" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
