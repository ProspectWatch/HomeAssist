"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ProductPicker } from "@/components/catalog/product-picker";
import { useToast } from "@/components/shell/toast-context";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ReceiptDetail, ReceiptLine } from "@/lib/data/receipts";
import { CATALOG_CATEGORIES, subcategoriesFor } from "@/lib/catalog/categories";
import { confirmReceipt, createProductForReceiptLine, updateReceiptHeader, updateReceiptLine } from "../actions";

/** Lines that need a human decision before the receipt can be trusted. */
function needsAttention(line: ReceiptLine): boolean {
  if (line.match_status === "IGNORED" || line.confirmed_by_user) return false;
  if (line.line_type !== "ITEM" && line.line_type !== "UNKNOWN") return false;
  return line.match_status !== "MATCHED";
}

export function ReceiptReviewView({ receipt }: { receipt: ReceiptDetail }) {
  const [pending, startTransition] = React.useTransition();
  const [pickerFor, setPickerFor] = React.useState<string | null>(null);
  const [newProductFor, setNewProductFor] = React.useState<{ lineId: string; name: string } | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  const [date, setDate] = React.useState(receipt.purchased_at ?? "");
  const router = useRouter();
  const showToast = useToast();

  const productLines = receipt.lines.filter((l) => l.line_type === "ITEM" || l.line_type === "UNKNOWN");
  const uncertain = productLines.filter(needsAttention);
  const settled = productLines.filter((l) => !needsAttention(l));
  const otherLines = receipt.lines.filter((l) => l.line_type !== "ITEM" && l.line_type !== "UNKNOWN");
  const verified = receipt.status === "VERIFIED";

  function setLine(lineId: string, update: { catalogProductId?: string | null; ignore?: boolean }) {
    startTransition(async () => {
      const res = await updateReceiptLine(receipt.id, lineId, update);
      if (!res.ok) showToast(res.message);
      else router.refresh();
    });
  }

  function addProduct(lineId: string, name: string, category: string, subcategory: string) {
    startTransition(async () => {
      const res = await createProductForReceiptLine(receipt.id, lineId, {
        displayName: name,
        category,
        subcategory: subcategory || null,
      });
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      setNewProductFor(null);
      showToast(`Added ${name} to the catalogue`);
      router.refresh();
    });
  }

  function saveDate() {
    startTransition(async () => {
      const res = await updateReceiptHeader(receipt.id, { purchasedAt: date || null });
      if (!res.ok) showToast(res.message);
      else {
        showToast("Date saved");
        router.refresh();
      }
    });
  }

  function confirmAll() {
    startTransition(async () => {
      const res = await confirmReceipt(receipt.id);
      if (!res.ok) showToast(res.message);
      else {
        showToast(
          `Verified — ${res.purchasesCreated ?? 0} purchases, ${res.observationsCreated ?? 0} price observations recorded`,
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="pb-10">
      <div className="flex items-center gap-1 px-3 pt-4 pb-1">
        <Link
          href="/receipts"
          aria-label="Back to Receipts"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-serif text-[24px] leading-tight text-ink">
          {verified ? "Receipt" : "Receipt review"}
        </h1>
      </div>

      <div className="mx-5 mb-3 rounded-(--radius-md) border border-line bg-white p-3.5">
        <div className="text-[15px] font-semibold text-ink">{receipt.retailer_name ?? "Store not identified"}</div>
        <div className="mt-0.5 text-[12px] text-muted">
          {receipt.total_cents != null ? formatCents(receipt.total_cents) : "Total not read"}
          {receipt.purchased_time ? ` · ${receipt.purchased_time}` : ""}
        </div>
        {receipt.extraction_confidence != null ? (
          <div className="mt-1 text-[11px] text-muted2">
            Read with {Math.round(receipt.extraction_confidence * 100)}% confidence
          </div>
        ) : null}

        {!receipt.purchased_at && !verified ? (
          <div className="mt-3">
            <label htmlFor="purchased" className="mb-1 block text-[12px] font-semibold text-ink">
              Purchase date — needed before verifying
            </label>
            <div className="flex gap-2">
              <Input id="purchased" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1" />
              <Button size="sm" disabled={pending || !date} onClick={saveDate}>
                Save
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {receipt.extraction_error ? (
        <div className="mx-5 mb-3 flex gap-2 rounded-(--radius-sm) bg-[#f8ebe7] p-3 text-[12px] text-[#b5482f]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{receipt.extraction_error}</span>
        </div>
      ) : null}

      {verified ? (
        <div className="mx-5 mb-3 flex items-center gap-2 rounded-(--radius-sm) bg-[#eaf3ed] p-3 text-[12.5px] font-semibold text-[#3f7a58]">
          <Check className="h-4 w-4" />
          Verified — these prices are in your household history.
        </div>
      ) : null}

      {/* Only uncertain lines demand attention; confident ones are summarized (§7). */}
      {uncertain.length > 0 && !verified ? (
        <section className="mb-4">
          <div className="px-5 pb-2 text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
            Needs your eye ({uncertain.length})
          </div>
          <div className="flex flex-col gap-2 px-5">
            {uncertain.map((line) => (
              <LineCard
                key={line.id}
                line={line}
                pending={pending}
                onChoose={() => setPickerFor(line.id)}
                onIgnore={() => setLine(line.id, { ignore: true })}
                onAccept={
                  line.catalog_product_name
                    ? () => setLine(line.id, { catalogProductId: line.catalog_product_id })
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {settled.length > 0 ? (
        <section className="mb-4">
          <div className="flex items-baseline justify-between px-5 pb-2">
            <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
              Matched ({settled.length})
            </div>
            <button
              type="button"
              className="text-[12px] font-semibold text-muted underline"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Hide" : "Show"}
            </button>
          </div>
          {showAll ? (
            <div className="flex flex-col gap-2 px-5">
              {settled.map((line) => (
                <LineCard
                  key={line.id}
                  line={line}
                  pending={pending || verified}
                  onChoose={() => setPickerFor(line.id)}
                  onIgnore={() => setLine(line.id, { ignore: true })}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {otherLines.length > 0 ? (
        <section className="mb-4 px-5">
          <div className="pb-2 text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
            Totals &amp; adjustments
          </div>
          <div className="rounded-(--radius-sm) border border-line bg-white">
            {otherLines.map((line) => (
              <div key={line.id} className="flex justify-between border-b border-line px-3 py-2 text-[12.5px] last:border-0">
                <span className="text-muted">{line.raw_description}</span>
                <span className="font-semibold">
                  {line.line_total_cents != null ? formatCents(line.line_total_cents) : "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!verified ? (
        <div className="px-5">
          <Button size="lg" className="w-full" disabled={pending} onClick={confirmAll}>
            {uncertain.length > 0
              ? `Confirm receipt (${uncertain.length} still unreviewed)`
              : "Confirm receipt"}
          </Button>
          <p className="mt-2 text-center text-[11.5px] text-muted2">
            Only confirmed lines become household purchase history.
          </p>
        </div>
      ) : null}

      <BottomSheet open={pickerFor !== null} onClose={() => setPickerFor(null)}>
        <div className="mb-3 text-sm font-semibold">Which product is this?</div>
        <ProductPicker
          autoFocus
          placeholder="Search the catalogue…"
          onSelect={(product) => {
            if (pickerFor) setLine(pickerFor, { catalogProductId: product.id });
            setPickerFor(null);
          }}
          onCustom={(name) => {
            if (pickerFor) setNewProductFor({ lineId: pickerFor, name });
            setPickerFor(null);
          }}
        />
      </BottomSheet>

      <BottomSheet open={newProductFor !== null} onClose={() => setNewProductFor(null)}>
        {newProductFor ? (
          <NewProductForm
            initialName={newProductFor.name}
            rawDescription={
              receipt.lines.find((l) => l.id === newProductFor.lineId)?.raw_description ?? null
            }
            pending={pending}
            onCancel={() => setNewProductFor(null)}
            onSave={(name, category, subcategory) =>
              addProduct(newProductFor.lineId, name, category, subcategory)
            }
          />
        ) : null}
      </BottomSheet>
    </div>
  );
}

/**
 * Adds a product the catalogue doesn't have yet.
 *
 * Deliberately asks a person to name it: the receipt only ever prints an
 * abbreviation ("LAYS OLD FSH BBQ"), and guessing what that expands to would
 * put an invented product name into shared household data. The raw text is
 * shown as evidence and kept as a search alias, so the next receipt matches
 * this product without asking again.
 */
function NewProductForm({
  initialName,
  rawDescription,
  pending,
  onCancel,
  onSave,
}: {
  initialName: string;
  rawDescription: string | null;
  pending: boolean;
  onCancel: () => void;
  onSave: (name: string, category: string, subcategory: string) => void;
}) {
  const [name, setName] = React.useState(initialName);
  const [category, setCategory] = React.useState("");
  const [subcategory, setSubcategory] = React.useState("");
  const subcategories = subcategoriesFor(category);

  return (
    <div>
      <div className="mb-1 text-sm font-semibold">Add this as a new product</div>
      {rawDescription ? (
        <p className="mb-3 text-[12px] text-muted">
          The receipt reads <code className="text-ink">{rawDescription}</code>. Name it as you&apos;d
          recognise it — we&apos;ll remember this shorthand next time.
        </p>
      ) : null}

      <label htmlFor="np-name" className="mb-1 block text-[12px] font-semibold text-ink">
        Product name
      </label>
      <Input
        id="np-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Lay's Old Fashioned BBQ Chips"
        className="mb-3"
        autoFocus
      />

      <label htmlFor="np-category" className="mb-1 block text-[12px] font-semibold text-ink">
        Category
      </label>
      <select
        id="np-category"
        value={category}
        onChange={(e) => {
          setCategory(e.target.value);
          setSubcategory("");
        }}
        className="mb-3 min-h-11 w-full rounded-(--radius-sm) border border-line bg-white px-3 text-[14px] text-ink"
      >
        <option value="">Choose a category…</option>
        {CATALOG_CATEGORIES.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>

      {subcategories.length > 0 ? (
        <>
          <label htmlFor="np-subcategory" className="mb-1 block text-[12px] font-semibold text-ink">
            Aisle <span className="font-normal text-muted2">(optional)</span>
          </label>
          <select
            id="np-subcategory"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            className="mb-3 min-h-11 w-full rounded-(--radius-sm) border border-line bg-white px-3 text-[14px] text-ink"
          >
            <option value="">Not sure</option>
            {subcategories.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </>
      ) : null}

      <div className="mt-1 flex gap-2">
        <Button
          size="lg"
          className="flex-1"
          disabled={pending || name.trim().length < 2 || !category}
          onClick={() => onSave(name.trim(), category, subcategory)}
        >
          Add to catalogue
        </Button>
        <Button size="lg" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function LineCard({
  line,
  pending,
  onChoose,
  onIgnore,
  onAccept,
}: {
  line: ReceiptLine;
  pending: boolean;
  onChoose: () => void;
  onIgnore: () => void;
  onAccept?: () => void;
}) {
  return (
    <div className="rounded-(--radius-md) border border-line bg-white p-3">
      <div className="flex items-baseline justify-between gap-2">
        {/* Raw receipt text, always shown — it's the evidence behind the match. */}
        <code className="min-w-0 flex-1 truncate text-[12px] text-muted">{line.raw_description}</code>
        <span className="shrink-0 font-serif text-[14px] font-semibold">
          {line.line_total_cents != null ? formatCents(line.line_total_cents) : "—"}
        </span>
      </div>

      <div className="mt-1.5 text-[14px] font-semibold text-ink">
        {line.catalog_product_name ?? "No match yet"}
      </div>
      <div className="text-[11px] text-muted2">
        {line.quantity != null ? `Qty ${line.quantity} · ` : ""}
        {line.unit_price_cents != null ? `${formatCents(line.unit_price_cents)} each · ` : ""}
        {line.match_confidence != null ? `${Math.round(line.match_confidence * 100)}% confident` : "unmatched"}
      </div>

      <div className="mt-2.5 flex gap-1.5">
        {onAccept ? (
          <button
            type="button"
            disabled={pending}
            onClick={onAccept}
            className={cn(
              "min-h-10 flex-1 rounded-(--radius-sm) border border-ink bg-ink text-[13px] font-semibold text-white",
              "disabled:opacity-60",
            )}
          >
            Accept
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={onChoose}
          className="min-h-10 flex-1 rounded-(--radius-sm) border border-line bg-cream text-[13px] font-semibold text-ink disabled:opacity-60"
        >
          Change
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onIgnore}
          className="min-h-10 flex-1 rounded-(--radius-sm) border border-line bg-white text-[13px] font-semibold text-muted disabled:opacity-60"
        >
          Ignore
        </button>
      </div>
    </div>
  );
}
