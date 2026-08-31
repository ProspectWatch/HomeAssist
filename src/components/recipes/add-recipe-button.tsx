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
        open={open}
        onClose={() => setOpen(false)}
        screenshotAvailable={screenshotAvailable}
      />
    </>
  );
}
