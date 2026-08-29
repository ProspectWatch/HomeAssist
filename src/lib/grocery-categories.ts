export const CATEGORY_ORDER = ["Meat", "Dairy", "Produce", "Pantry", "Frozen", "Household", "Other"] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  Meat: "MEAT & SEAFOOD",
  Dairy: "DAIRY & EGGS",
  Produce: "PRODUCE",
  Pantry: "PANTRY",
  Frozen: "FROZEN",
  Household: "HOUSEHOLD",
  Other: "OTHER",
};
