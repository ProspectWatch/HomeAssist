-- catalog_products.search_text included category/subcategory text, so a
-- query like "eggs" (a substring of the category "Dairy & Eggs") matched
-- every dairy product, not just eggs — caught by the QA search list in
-- the Phase 2B brief. Category-driven discovery belongs to Browse (step
-- 5); this stays a product-identity search (name/brand/aliases only),
-- matching the client-side searchCatalog() in src/lib/catalog-search.ts.
create or replace function catalog_products_set_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text := product_search_normalize(
    new.display_name || ' ' || coalesce(new.brand, '') || ' ' ||
    array_to_string(new.search_aliases, ' ')
  );
  return new;
end;
$$;

update catalog_products set updated_at = now();
