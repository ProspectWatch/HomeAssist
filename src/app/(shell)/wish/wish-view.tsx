"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/nav/top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { AddItemBar } from "@/components/ui/add-item-bar";
import { CollapsibleSection, useSectionState } from "@/components/ui/collapsible-section";
import { useToast } from "@/components/shell/toast-context";
import { formatCents } from "@/lib/money";
import { OCCASIONS, OCCASION_LABEL, PRIORITY_LABEL, type WishItem } from "@/lib/wish/model";
import type { WishList } from "@/lib/data/wish-lists";
import type { HouseholdPerson } from "@/lib/household/people";
import type { ImportedProduct } from "@/lib/products/link-import";
import {
  addWishItem,
  addWishOffer,
  lookUpProductLink,
  removeWishItem,
  setWishItemStatus,
} from "./actions";

/**
 * Wish lists — what each person would like, and where it can be had.
 *
 * The way in is a link. A child pasting the page they are already looking at
 * gets the picture, the price and the shop without typing any of it, and the
 * picture is most of what makes a list of wishes readable at a glance.
 *
 * Everyone in the household sees every list, including the "got it" markers.
 * That is a property of the app — children are people here without logins —
 * and the screen says so rather than implying a secrecy it cannot enforce.
 */
export function WishView({ lists, people }: { lists: WishList[]; people: HouseholdPerson[] }) {
  const router = useRouter();
  const showToast = useToast();
  const [adding, setAdding] = React.useState<{ personId: string | null } | null>(null);
  const [addingOfferTo, setAddingOfferTo] = React.useState<WishItem | null>(null);
  const [pending, startTransition] = React.useTransition();
  const sections = useSectionState("wish-sections", true);

  const anything = lists.some((l) => l.items.length > 0);

  function act(work: () => Promise<{ ok: boolean; message?: string }>, done?: string) {
    startTransition(async () => {
      const res = await work();
      if (!res.ok) showToast(res.message ?? "That didn't work.");
      else {
        if (done) showToast(done);
        router.refresh();
      }
    });
  }

  return (
    <>
      <TopBar title="Wish Lists" />

      <div className="px-5 pb-3">
        <p className="text-[12.5px] leading-snug text-muted">
          Paste a link to something and it picks up the picture and the price. Everyone
          in the house can see every list, including what&rsquo;s been bought.
        </p>
      </div>

      {people.length === 0 ? (
        <div className="px-5">
          <EmptyState
            title="Add the family first"
            description="A wish list belongs to a person. Add everyone on the Family screen and their lists appear here."
          />
        </div>
      ) : (
        <>
          <div className="mb-4 px-5">
            <AddItemBar label="Add something to a wish list" onClick={() => setAdding({ personId: people[0]?.id ?? null })} />
          </div>

          {!anything ? (
            <div className="px-5">
              <EmptyState
                title="Nothing wished for yet"
                description="Paste a link to a toy, a game, a bike — anything worth saving up for."
              />
            </div>
          ) : (
            lists.map((list) => {
              const id = list.person?.id ?? "__shared";
              const wanted = list.items.filter((i) => i.status === "WANTED");
              return (
                <CollapsibleSection
                  key={id}
                  title={list.person?.name ?? "Everyone"}
                  count={wanted.length}
                  open={sections.isOpen(id)}
                  onToggle={() => sections.toggle(id)}
                  columns={1}
                >
                  {list.items.map((item) => (
                    <WishCard
                      key={item.id}
                      item={item}
                      disabled={pending}
                      onAddOffer={() => setAddingOfferTo(item)}
                      onToggleGot={() =>
                        act(
                          () =>
                            setWishItemStatus(item.id, item.status === "GOT_IT" ? "WANTED" : "GOT_IT"),
                          item.status === "GOT_IT" ? "Back on the list" : "Marked as bought",
                        )
                      }
                      onRemove={() => act(() => removeWishItem(item.id), "Removed")}
                    />
                  ))}
                </CollapsibleSection>
              );
            })
          )}
        </>
      )}

      <AddWishSheet
        key={adding ? "add-open" : "add-closed"}
        open={adding !== null}
        people={people}
        initialPersonId={adding?.personId ?? null}
        onClose={() => setAdding(null)}
        onSaved={() => {
          setAdding(null);
          router.refresh();
        }}
      />

      <AddOfferSheet
        key={addingOfferTo?.id ?? "offer-closed"}
        item={addingOfferTo}
        onClose={() => setAddingOfferTo(null)}
        onSaved={() => {
          setAddingOfferTo(null);
          router.refresh();
        }}
      />
    </>
  );
}

function WishCard({
  item,
  disabled,
  onAddOffer,
  onToggleGot,
  onRemove,
}: {
  item: WishItem;
  disabled: boolean;
  onAddOffer: () => void;
  onToggleGot: () => void;
  onRemove: () => void;
}) {
  const got = item.status === "GOT_IT";
  return (
    <div
      className={`rounded-(--radius-md) border border-line bg-white p-3 shadow-(--shadow-card) ${got ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-(--radius-sm) bg-cream md:h-28 md:w-28">
          {/* A plain <img>, not next/image, and deliberately so. These come
              from whatever shop the link points at, and the only way to let
              next/image handle them would be to allow every hostname — which
              turns the image optimizer into an open proxy that fetches any URL
              anyone can put in the box. An unoptimized thumbnail is a much
              smaller cost than that. */}
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-contain p-1.5"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] leading-snug font-semibold md:text-[16px]">{item.title}</div>
          <div className="mt-0.5 text-[11.5px] text-muted">
            {OCCASION_LABEL[item.occasion]} · {PRIORITY_LABEL[item.priority] ?? "Would like"}
            {got ? " · Bought" : ""}
          </div>
          {item.notes ? (
            <div className="mt-1 text-[12px] leading-snug text-muted2">{item.notes}</div>
          ) : null}

          {/* Cheapest first, and only where a shop actually gave up a price —
              a shop whose page said nothing is listed without one rather than
              being quietly left out or given a made-up number. */}
          {item.offers.length > 0 ? (
            <div className="mt-2 flex flex-col gap-1">
              {item.offers.map((offer, index) => (
                <a
                  key={offer.id}
                  href={offer.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex items-baseline justify-between gap-2 text-[12.5px]"
                >
                  <span className="truncate text-ink underline decoration-dotted underline-offset-2">
                    {offer.siteName ?? "Link"}
                  </span>
                  <span
                    className={
                      offer.priceCents === null
                        ? "shrink-0 text-muted2"
                        : index === 0 && item.offers.length > 1
                          ? "shrink-0 font-semibold text-green"
                          : "shrink-0 font-semibold text-ink"
                    }
                  >
                    {offer.priceCents === null ? "no price shown" : formatCents(offer.priceCents)}
                  </span>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-3 border-t border-line pt-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onAddOffer}
          className="cursor-pointer text-[12px] font-semibold text-ink disabled:opacity-50"
        >
          + Another shop
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onToggleGot}
          className="cursor-pointer text-[12px] font-semibold text-oak disabled:opacity-50"
        >
          {got ? "Not bought after all" : "Mark as bought"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          className="ml-auto cursor-pointer text-[12px] font-semibold text-muted2 disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

/** Paste a link, check what came back, save it. */
function AddWishSheet({
  open,
  people,
  initialPersonId,
  onClose,
  onSaved,
}: {
  open: boolean;
  people: HouseholdPerson[];
  initialPersonId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const showToast = useToast();
  const [url, setUrl] = React.useState("");
  const [found, setFound] = React.useState<ImportedProduct | null>(null);
  const [title, setTitle] = React.useState("");
  const [personId, setPersonId] = React.useState<string | null>(initialPersonId);
  const [occasion, setOccasion] = React.useState<string>("ANYTIME");
  const [priority, setPriority] = React.useState(2);
  const [notes, setNotes] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function look() {
    startTransition(async () => {
      const res = await lookUpProductLink(url);
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      setFound(res.product);
      setTitle(res.product.title);
    });
  }

  function save() {
    startTransition(async () => {
      const res = await addWishItem({
        personId,
        title,
        occasion,
        priority,
        notes,
        imageUrl: found?.imageUrl ?? null,
        offer: found
          ? {
              url: found.sourceUrl,
              siteName: found.siteName,
              priceCents: found.priceCents,
              currency: found.currency,
              brand: found.brand,
            }
          : null,
      });
      if (!res.ok) showToast(res.message);
      else onSaved();
    });
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="mb-3 text-sm font-semibold">Add to a wish list</div>

      <label className="mb-1 block text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
        Paste a link
      </label>
      <div className="mb-1.5 flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          inputMode="url"
          className="flex-1"
        />
        <Button disabled={pending || url.trim().length === 0} onClick={look}>
          {pending ? "…" : "Read"}
        </Button>
      </div>
      <p className="mb-3 text-[11.5px] leading-snug text-muted">
        Picks up the picture, the price and the shop. Some shops block this — if one
        does, it&rsquo;ll say so and you can type the name in instead.
      </p>

      {found ? (
        <div className="mb-3 flex items-center gap-3 rounded-(--radius-md) border border-line bg-white p-2.5">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-(--radius-sm) bg-cream">
            {found.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={found.imageUrl}
                alt={found.title}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-contain p-1"
              />
            ) : null}
          </div>
          <div className="min-w-0 text-[12px]">
            <div className="text-muted">{found.siteName}</div>
            <div className="font-semibold text-ink">
              {found.priceCents === null ? "No price on the page" : formatCents(found.priceCents)}
            </div>
          </div>
        </div>
      ) : null}

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What is it?"
        className="mb-2"
      />

      <label className="mb-1 block text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
        Whose list
      </label>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {people.map((person) => (
          <button key={person.id} type="button" onClick={() => setPersonId(person.id)} className={chip(personId === person.id)}>
            {person.name}
          </button>
        ))}
        <button type="button" onClick={() => setPersonId(null)} className={chip(personId === null)}>
          Everyone
        </button>
      </div>

      <label className="mb-1 block text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
        What for
      </label>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {OCCASIONS.map((o) => (
          <button key={o} type="button" onClick={() => setOccasion(o)} className={chip(occasion === o)}>
            {OCCASION_LABEL[o]}
          </button>
        ))}
      </div>

      <label className="mb-1 block text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
        How much they want it
      </label>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {[3, 2, 1].map((p) => (
          <button key={p} type="button" onClick={() => setPriority(p)} className={chip(priority === p)}>
            {PRIORITY_LABEL[p]}
          </button>
        ))}
      </div>

      <Input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Size, colour, anything else"
        className="mb-3"
      />

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-1" disabled={pending || title.trim().length === 0} onClick={save}>
          {pending ? "Saving…" : "Add to list"}
        </Button>
      </div>
    </BottomSheet>
  );
}

/** Another shop for the same thing — this is what comparing prices means here. */
function AddOfferSheet({
  item,
  onClose,
  onSaved,
}: {
  item: WishItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const showToast = useToast();
  const [url, setUrl] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function add() {
    if (!item) return;
    startTransition(async () => {
      const look = await lookUpProductLink(url);
      if (!look.ok) {
        showToast(look.message);
        return;
      }
      const res = await addWishOffer({
        itemId: item.id,
        url: look.product.sourceUrl,
        siteName: look.product.siteName,
        priceCents: look.product.priceCents,
        currency: look.product.currency,
        brand: look.product.brand,
      });
      if (!res.ok) showToast(res.message);
      else onSaved();
    });
  }

  return (
    <BottomSheet open={item !== null} onClose={onClose}>
      <div className="mb-1 text-sm font-semibold">Another shop</div>
      <p className="mb-3 text-[11.5px] leading-snug text-muted">
        Paste the same thing from a different shop and the list shows which is cheaper.
      </p>
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          inputMode="url"
          className="flex-1"
        />
        <Button disabled={pending || url.trim().length === 0} onClick={add}>
          {pending ? "…" : "Add"}
        </Button>
      </div>
    </BottomSheet>
  );
}

function chip(active: boolean): string {
  return active
    ? "cursor-pointer rounded-(--radius-sm) border border-ink bg-ink px-3 py-1.5 text-[12px] font-semibold text-white"
    : "cursor-pointer rounded-(--radius-sm) border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink";
}
