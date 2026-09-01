"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function BottomSheet({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[180] bg-[rgba(29,29,27,.45)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        // A sheet rising from the bottom edge is right on a phone, where that
        // edge is under your thumb. On a tablet it is the far side of a large
        // screen and the content ends up in a strip along the bottom, so above
        // the breakpoint the same sheet becomes a centred dialog.
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[22px] bg-white px-5 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+1.75rem)] shadow-[0_-12px_28px_rgba(29,29,27,.2)]",
          "md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:max-h-[86vh] md:w-[30rem] md:max-w-[calc(100vw-3rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:overflow-y-auto md:rounded-[22px] md:pb-6 md:shadow-[0_18px_48px_rgba(29,29,27,.28)]",
          className,
        )}
      >
        {/* The grab handle is a phone affordance for a sheet you can drag. */}
        <div className="mx-auto mt-1 mb-4 h-1 w-9 rounded-full bg-line md:hidden" />
        {children}
      </div>
    </div>
  );
}

export function CenterModal({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[190] flex items-center justify-center bg-[rgba(29,29,27,.45)] p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[84vh] w-full max-w-[360px] flex-col gap-2.5 overflow-auto rounded-[18px] bg-white p-5",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function SheetRow({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-between border-b border-line py-3.5 text-left last:border-b-0"
    >
      <span className="text-[15px] font-medium text-ink">{label}</span>
      <span className="text-muted2">→</span>
    </button>
  );
}
