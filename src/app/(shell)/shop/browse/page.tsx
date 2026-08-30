import { getCatalogCategories } from "@/lib/data/catalog";
import { BrowseView } from "./browse-view";

export default async function BrowsePage() {
  const categories = await getCatalogCategories();
  return <BrowseView categories={categories} />;
}
