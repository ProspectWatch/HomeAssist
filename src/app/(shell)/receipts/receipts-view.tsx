"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Receipt as ReceiptIcon, Upload } from "lucide-react";
import { HeroImage } from "@/components/ui/hero-image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/shell/toast-context";
import { storeBadge, RECEIPTS_HERO_IMAGE } from "@/lib/assets";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Receipt } from "@/lib/data/receipts";
import type { ReceiptStatus } from "@/lib/receipts/types";
import { createClient } from "@/lib/supabase/client";
import { shrinkReceiptImage } from "@/lib/receipts/downscale";
import { validateReceiptUpload } from "@/lib/receipts/upload";
import { ingestUploadedReceipt, prepareReceiptUpload } from "./actions";

const STATUS_LABEL: Record<ReceiptStatus, string> = {
  UPLOADED: "Saved — not read yet",
  PROCESSING: "Reading…",
  REVIEW_REQUIRED: "Needs review",
  VERIFIED: "Verified",
  FAILED: "Couldn't read",
};

function statusTone(status: ReceiptStatus): string {
  switch (status) {
    case "VERIFIED":
      return "bg-[#eaf3ed] text-[#3f7a58]";
    case "FAILED":
      return "bg-[#f8ebe7] text-[#b5482f]";
    case "REVIEW_REQUIRED":
      return "bg-cream text-oak";
    default:
      return "bg-cream text-muted";
  }
}

export function ReceiptsView({
  receipts,
  extractionConfigured,
}: {
  receipts: Receipt[];
  extractionConfigured: boolean;
}) {
  const [search, setSearch] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const uploadRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();
  const showToast = useToast();

  const filtered = receipts.filter((r) =>
    (r.retailer_name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  /**
   * Photo -> private Storage -> server.
   *
   * The image goes straight to the bucket under this signed-in session; only
   * the object path crosses a Server Action. Sending the bytes through the
   * action is what produced the 413 — a Vercel Function refuses any body over
   * 4.5 MB, and receipt photos are routinely larger.
   */
  function submitFile(original: File) {
    startTransition(async () => {
      const file = await shrinkReceiptImage(original);

      const check = validateReceiptUpload({ size: file.size, mediaType: file.type });
      if (!check.ok) {
        showToast(check.message);
        return;
      }

      const target = await prepareReceiptUpload({
        filename: file.name || "receipt.jpg",
        mediaType: file.type,
        size: file.size,
      });
      if (!target.ok) {
        showToast(target.message);
        return;
      }

      const { error: storageError } = await createClient()
        .storage.from("receipts")
        .upload(target.storagePath, file, { contentType: file.type, upsert: false });
      if (storageError) {
        showToast("Couldn't upload that photo — check your connection and try again.");
        return;
      }

      const res = await ingestUploadedReceipt({
        storagePath: target.storagePath,
        mediaType: file.type,
        filename: file.name || "receipt.jpg",
      });
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      if (res.duplicateWarning) showToast(res.duplicateWarning);
      router.refresh();
      if (res.receiptId) router.push(`/receipts/${res.receiptId}`);
    });
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) submitFile(file);
  }

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-3.5">
        <h1 className="mb-3 font-serif text-[26px] leading-tight text-ink">Receipts</h1>
        <div className="mb-3">
          <HeroImage src={RECEIPTS_HERO_IMAGE} alt="Receipts" height={150} tabletHeight={230} radiusClassName="rounded-(--radius-lg)" />
        </div>

        {!extractionConfigured ? (
          <p className="mb-3 rounded-(--radius-sm) bg-cream px-3 py-2 text-[12px] leading-snug text-muted">
            Receipts will be saved securely, but automatic reading isn&apos;t switched on yet. Add an
            extraction API key in the deployment settings to have HomeAssist read them for you.
          </p>
        ) : null}

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search receipts"
          className="mb-3"
        />

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onPick}
        />
        <input ref={uploadRef} type="file" accept="image/*" hidden onChange={onPick} />

        <div className="flex gap-2">
          <Button size="lg" className="flex-1" disabled={pending} onClick={() => cameraRef.current?.click()}>
            <Camera className="mr-1.5 h-4 w-4" />
            {pending ? "Reading…" : "Take photo"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1 bg-white"
            disabled={pending}
            onClick={() => uploadRef.current?.click()}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={ReceiptIcon}
            title="No receipts yet"
            description="Photograph a receipt after shopping to start building real price history."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-5">
          {filtered.map((r) => {
            const badge = storeBadge(r.retailer_name);
            return (
              <Link
                key={r.id}
                href={`/receipts/${r.id}`}
                className="flex items-center gap-2.5 rounded-(--radius-sm) border border-line bg-white p-3 shadow-(--shadow-card)"
              >
                <span
                  className="rounded-[6px] px-2 py-[3px] text-[10px]"
                  style={{ background: badge.bg, color: badge.color, border: badge.border }}
                >
                  {r.retailer_name ?? "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold">{r.retailer_name ?? "Unknown store"}</div>
                  <div className="text-[11px] text-muted">
                    {r.purchased_at ? new Date(r.purchased_at).toLocaleDateString() : "Date not read"} ·{" "}
                    {r.item_count} lines
                  </div>
                  <span
                    className={cn(
                      "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      statusTone(r.status),
                    )}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <div className="font-serif text-sm font-semibold">
                  {r.total_cents != null ? formatCents(r.total_cents) : "—"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
