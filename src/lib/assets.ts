// Approved photography from the Claude Design handoff, mirrored under
// public/images/. Per the handoff: these are stand-in/placeholder photos
// selected to match real local products — keep using them (don't swap in
// generic stock) until licensed/store-sourced photography replaces them.

export const DEPARTMENT_HERO_IMAGES: Record<string, string> = {
  kitchen: "/images/departments/pantry-hero.jpg",
  sports: "/images/departments/sports-hero.jpg",
  hometech: "/images/departments/hometech-hero.jpg",
  furniture: "/images/departments/furniture-hero.jpg",
  appliances: "/images/departments/appliances-hero.jpg",
  bathrooms: "/images/departments/bathrooms-hero.jpg",
  laundry: "/images/departments/laundry-hero.jpg",
  cleaning: "/images/departments/cleaning-hero.jpg",
  yard: "/images/departments/yard-hero.jpg",
  decor: "/images/departments/decor-hero.jpg",
};

export const HOME_HERO_IMAGE = "/images/departments/home-hero.jpg";
export const PANTRY_HERO_IMAGE = "/images/departments/pantry-hero.jpg";
export const DEALS_HERO_IMAGE = "/images/misc/deals-hero.jpg";
export const RECEIPTS_HERO_IMAGE = "/images/misc/receipts-hero.jpg";
export const STORES_HERO_IMAGE = "/images/misc/stores-hero.png";

// name -> product photo, matched by exact product/pantry-item name (as
// authored in the handoff's reference PANTRY/product list). Falls back to
// null (no image) for anything not in the approved asset set — never
// substitute a generic stock photo for a real product image slot.
export const PRODUCT_IMAGES: Record<string, string> = {
  "Chicken Breast": "/images/products/chicken-breast.jpg",
  "AAA Striploin Steak": "/images/products/steak.jpg",
  "Striploin Steak": "/images/products/steak.jpg",
  "Pork Chops": "/images/products/pork.png",
  "Fast-Fry Beef": "/images/products/fast-fry-beef.png",
  "Ground Beef": "/images/products/ground-beef.jpg",
  Meatballs: "/images/products/meatballs.png",
  "Deli Meat": "/images/products/deli-meat.png",
  Bread: "/images/products/bread.png",
  "Ice Cream": "/images/products/ice-cream.png",
  Gelato: "/images/products/gelato.png",
  Popsicles: "/images/products/popsicles.png",
  "Earth's Own Almond Milk": "/images/products/earths-own-original-almond-milk.jpg",
  "Lactantia Lactose-Free Milk": "/images/products/lactantia-or-neilson-2-lactose-free-milk.jpg",
  "Conestoga Free-Range Eggs": "/images/products/conestoga-brown-free-range-eggs.jpg",
  Bananas: "/images/products/bananas.jpg",
  Apples: "/images/products/apples.jpg",
  Strawberries: "/images/products/strawberries.jpg",
  Potatoes: "/images/products/potatoes.jpg",
  Rice: "/images/products/rice.jpg",
  "Cheddar Cheese Block": "/images/products/cheddar-cheese-block.jpg",
  "Shredded Cheese Tex Mex": "/images/products/shredded-cheese-tex-mex.png",
  "Taco Kit": "/images/products/taco-kit.png",
  "Frozen Chicken Strips": "/images/products/frozen-chicken-strips.png",
  "French Fries": "/images/products/french-fries.png",
  "Marilu's Mac and Cheese": "/images/products/marilus-mac-and-cheese.png",
  Butter: "/images/products/butter.png",
  Yogurt: "/images/products/yogurt.jpg",
  "Cream Cheese": "/images/products/cream-cheese.png",
  "Orange Juice": "/images/products/orange-juice.png",
  Cereal: "/images/products/cereal.png",
  Oatmeal: "/images/products/oatmeal.png",
  Pasta: "/images/products/pasta.png",
  "Pasta Sauce": "/images/products/pasta-sauce.png",
  "Peanut Butter": "/images/products/peanut-butter.png",
  Jam: "/images/products/jam.png",
  Tortillas: "/images/products/tortillas.png",
  Ketchup: "/images/products/ketchup.png",
  Mayonnaise: "/images/products/mayonnaise.png",
  "Chicken Broth": "/images/products/chicken-broth.png",
  "Frozen Pizza": "/images/products/frozen-pizza.png",
  "Frozen Vegetables": "/images/products/frozen-vegetables.png",
  Broccoli: "/images/products/broccoli.png",
  Carrots: "/images/products/carrots.png",
  Onions: "/images/products/onions.png",
  "Bell Peppers": "/images/products/bell-peppers.png",
  Lettuce: "/images/products/lettuce.png",
  Grapes: "/images/products/grapes.png",
  Blueberries: "/images/products/blueberries.png",
};

export function productImage(name: string): string | null {
  return PRODUCT_IMAGES[name] ?? null;
}

// Retailer badge colors, per the handoff's STORES map — used for the small
// store-tag chips (grocery list rows, deal cards, receipts). Only applied
// to retailers that are actually onboarded; unknown retailers fall back to
// a neutral chip.
export const STORE_BADGE: Record<string, { bg: string; color: string; border?: string }> = {
  "Marilu's": { bg: "#1b3a2f", color: "#eafff0" },
  Fortinos: { bg: "#ffffff", color: "#c8102e", border: "1px solid #c8102e" },
  Costco: { bg: "#ffffff", color: "#005dab", border: "1px solid #005dab" },
  "No Frills": { bg: "#ffe000", color: "#1a1a1a" },
  "Food Basics": { bg: "#1f6b3b", color: "#ffe000" },
  Amazon: { bg: "#161615", color: "#ffffff" },
  "Farm Boy": { bg: "#ffffff", color: "#2e7d32", border: "1px solid #2e7d32" },
  "Home Depot": { bg: "#ffffff", color: "#f96302", border: "1px solid #f96302" },
};

export function storeBadge(name: string | null | undefined) {
  return (name && STORE_BADGE[name]) || { bg: "#f7f4ee", color: "#211f1c" };
}
