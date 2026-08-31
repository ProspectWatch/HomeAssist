"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { RecipeImport } from "./recipe-import";

/** The client island on an otherwise server-rendered Recipes page. */
export function AddRecipeButton({ screenshotAvailable }: { screenshotAvailable: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button className="w-full" onClick={() => setOpen(true)}>
        Add a recipe
      </Button>
      <RecipeImport
        // A fresh sheet each time it opens, rather than one that has to clean
        // up after itself in an effect.
        key={open ? "open" : "closed"}
        open={open}
        onClose={() => setOpen(false)}
        screenshotAvailable={screenshotAvailable}
      />
    </>
  );
}
