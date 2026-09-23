"use client";
import * as React from "react";
import { DropdownMenu as M } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export const DropdownMenuGroup = M.Group;

export function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 6,
  container,
  ...props
}: React.ComponentProps<typeof M.Content> & { container?: HTMLElement | null }) {
  return (
    <M.Portal container={container ?? undefined}>
      <M.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-48 overflow-hidden rounded-lg border border-border bg-surface p-1 text-sm shadow-lg data-[state=open]:animate-scale-in",
          className,
        )}
        {...props}
      />
    </M.Portal>
  );
}

export function DropdownMenuItem({
  className,
  tone,
  ...props
}: React.ComponentProps<typeof M.Item> & { tone?: "danger" }) {
  return (
    <M.Item
      className={cn(
        "flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-fg outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-subtle",
        tone === "danger" && "text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuCheckboxItem({ className, children, ...props }: React.ComponentProps<typeof M.CheckboxItem>) {
  return (
    <M.CheckboxItem
      className={cn(
        "flex h-9 cursor-pointer items-center gap-2.5 rounded-md pr-2.5 pl-8 text-fg outline-none select-none data-[highlighted]:bg-surface-2 relative",
        className,
      )}
      {...props}
    >
      <M.ItemIndicator className="absolute left-2.5">
        <Check className="size-4 text-primary" />
      </M.ItemIndicator>
      {children}
    </M.CheckboxItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof M.Label>) {
  return <M.Label className={cn("px-2.5 pt-2 pb-1 text-caption font-medium text-subtle", className)} {...props} />;
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <M.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} />;
}
