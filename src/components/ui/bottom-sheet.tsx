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
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[22px] bg-white px-5 pt-2.5 pb-8 shadow-[0_-12px_28px_rgba(29,29,27,.2)]",
          className,
        )}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.75rem)" }}
      >
        <div className="mx-auto mb-4 mt-1 h-1 w-9 rounded-full bg-line" />
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
