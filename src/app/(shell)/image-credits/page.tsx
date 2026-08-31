import { TopBar } from "@/components/nav/top-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { getImageCredits } from "@/lib/data/image-credits";
import { ImageIcon } from "lucide-react";

export default async function ImageCreditsPage() {
  const credits = await getImageCredits();

  return (
    <div className="pb-8">
      <TopBar title="Image Credits" subtitle="Who took the product photos" />

      <p className="mx-5 mb-3.5 rounded-(--radius-sm) border border-line bg-cream/50 p-3.5 text-[11.5px] leading-relaxed text-muted">
        Product photography comes from Wikimedia Commons via Wikipedia. Most of these images are shared under a
        Creative Commons licence that allows this use provided the photographer is credited, so every one is listed
        here with its author, its licence and a link to the original.
      </p>

      {credits.length === 0 ? (
        <div className="px-5">
          <EmptyState icon={ImageIcon} title="No credited images yet" />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 px-5">
          {credits.map((credit, i) => (
            <div
              key={`${credit.name}-${i}`}
              className="rounded-(--radius-xs) border border-line bg-white px-3 py-2 shadow-(--shadow-card)"
            >
              <div className="text-[12.5px] font-semibold">{credit.name}</div>
              <div className="mt-0.5 text-[11px] text-muted">
                {credit.attribution} · {credit.license}
              </div>
              {credit.sourceUrl ? (
                <a
                  href={credit.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-0.5 inline-block text-[11px] font-semibold text-ink underline"
                >
                  Source
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
