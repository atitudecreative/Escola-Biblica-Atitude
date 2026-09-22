"use client";
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Drawer = D.Root;
export const DrawerTrigger = D.Trigger;
export const DrawerClose = D.Close;

export function DrawerContent({
  side = "right",
  title,
  description,
  children,
  className,
  hideHeader,
}: {
  side?: "left" | "right";
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
      <D.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-[88vw] max-w-sm flex-col border-border bg-surface shadow-lg outline-none",
          side === "left" ? "left-0 border-r data-[state=open]:animate-slide-in-left" : "right-0 border-l data-[state=open]:animate-slide-in-right",
          className,
        )}
      >
        {hideHeader ? (
          <>
            <D.Title className="sr-only">{title}</D.Title>
            <D.Description className="sr-only">{description ?? title}</D.Description>
          </>
        ) : (
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <D.Title className="text-h3">{title}</D.Title>
              <D.Description className={description ? "mt-0.5 text-small text-muted" : "sr-only"}>
                {description ?? title}
              </D.Description>
            </div>
            <D.Close className="rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Fechar">
              <X className="size-4" />
            </D.Close>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
