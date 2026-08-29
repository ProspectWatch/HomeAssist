import Image from "next/image";
import { cn } from "@/lib/utils";

export function HeroImage({
  src,
  alt,
  height,
  radiusClassName = "rounded-(--radius-xl)",
  overlay,
  caption,
  captionSubtitle,
  className,
  priority,
}: {
  src: string;
  alt: string;
  height: number;
  radiusClassName?: string;
  /** "fade" = bottom gradient only (Home hero); "full" = top-to-bottom scrim (Pantry/Deals hero with caption) */
  overlay?: "fade" | "full";
  caption?: string;
  captionSubtitle?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn("relative overflow-hidden", radiusClassName, className)}
      style={{ height }}
    >
      <Image src={src} alt={alt} fill sizes="402px" className="object-cover" priority={priority} />
      {overlay === "fade" ? (
        <div
          className="absolute inset-x-0 bottom-0 h-[60px]"
          style={{ background: "linear-gradient(to top, rgba(29,29,27,.5), transparent)" }}
        />
      ) : null}
      {overlay === "full" ? (
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(29,29,27,.55), rgba(29,29,27,.05))" }}
        />
      ) : null}
      {caption ? (
        <div className="absolute bottom-3.5 left-3.5 text-white">
          <div className="font-serif text-[19px] italic">{caption}</div>
          {captionSubtitle ? <div className="text-xs opacity-90">{captionSubtitle}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
