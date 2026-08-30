-- retailer_price_observations had a SELECT policy and nothing else, so every
-- insert was denied by RLS. verifyReceipt swallowed the error
-- (`if (!obsError) observationsCreated = ...`), so a verified receipt reported
-- success while writing no price history at all: 10 purchases and 10 learned
-- aliases landed, 0 observations did. Price history, deal comparison and any
-- future flyer matching all read this table, so they had nothing to read.
--
-- Scoped to the household that owns the observation, matching
-- household_purchases. Rows with a null household_id are retailer-wide
-- ingestion output and stay unwritable through a member's session on purpose —
-- that path runs server-side and should not inherit a household's grant.
drop policy if exists "members can add their household's price observations" on retailer_price_observations;
create policy "members can add their household's price observations"
  on retailer_price_observations for insert to authenticated
  with check (household_id is not null and is_household_member(household_id));

drop policy if exists "members can update their household's price observations" on retailer_price_observations;
create policy "members can update their household's price observations"
  on retailer_price_observations for update to authenticated
  using (household_id is not null and is_household_member(household_id))
  with check (household_id is not null and is_household_member(household_id));


-- The dedupe index keyed on (retailer, location, external_product_id, price,
-- date) and never on the product itself. That works for retailer-adapter rows,
-- which always carry an external_product_id — but a receipt has none, so two
-- DIFFERENT products bought at the same store on the same day for the same
-- price collided as duplicates. On a single grocery run that is common: two
-- $2.99 items and one of them is silently discarded.
--
-- Adding the catalogue product to the key keeps the original intent (don't
-- record the same product twice at the same price on the same day) while
-- letting distinct products share a price.
drop index if exists rpo_dedupe_same_day_same_price;
create unique index rpo_dedupe_same_day_same_price
  on retailer_price_observations (
    retailer_id,
    coalesce(retailer_location_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(external_product_id, ''),
    coalesce(catalog_product_id, ''),
    observed_price_cents,
    observed_on
  );

-- Backfill the observations the already-verified receipt should have written.
-- Same derivation verifyReceipt uses: unit price when the receipt printed one,
-- otherwise the line total. Only lines that resolved to a catalogue product and
-- carry a price, and only where the receipt names a retailer.
insert into retailer_price_observations
  (household_id, receipt_id, catalog_product_id, retailer_id, retailer_location_id,
   observed_price_cents, source_type, match_status, raw_name, observed_at)
select r.household_id, r.id, ri.catalog_product_id, r.retailer_id, r.retailer_location_id,
       coalesce(ri.unit_price_cents, ri.line_total_cents),
       'RECEIPT', 'MATCHED', ri.raw_description,
       (r.purchased_at::text || 'T12:00:00Z')::timestamptz
from receipts r
join receipt_items ri on ri.receipt_id = r.id
where r.status = 'VERIFIED'
  and r.retailer_id is not null
  and r.purchased_at is not null
  and ri.catalog_product_id is not null
  and ri.line_total_cents is not null
  and ri.match_status <> 'IGNORED'
  and ri.line_type in ('ITEM', 'UNKNOWN')
  and not exists (
    select 1 from retailer_price_observations o
    where o.receipt_id = r.id and o.catalog_product_id = ri.catalog_product_id
  )
-- Two lines can legitimately resolve to the same product at the same price on
-- the same day (buying two of something, or the extractor reading a line
-- twice). That is two purchases but one price point, so the dedupe index is
-- right to collapse it — matching verifyReceipt's own ignoreDuplicates.
on conflict do nothing;
