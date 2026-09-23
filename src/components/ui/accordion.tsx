"use client";
import * as React from "react";
import { Accordion as A } from "radix-ui";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Accordion = A.Root;

export function AccordionItem({ className, ...props }: React.ComponentProps<typeof A.Item>) {
  return <A.Item className={cn("border-b border-border last:border-b-0", className)} {...props} />;
}

export function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof A.Trigger>) {
  return (
    <A.Header className="flex">
      <A.Trigger
        className={cn(
          "group flex flex-1 items-center justify-between gap-4 py-4 text-left text-sm font-medium text-fg transition-colors hover:text-primary",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="size-4 shrink-0 text-subtle transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </A.Trigger>
    </A.Header>
  );
}

export function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof A.Content>) {
  return (
    <A.Content className="overflow-hidden data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" {...props}>
      <div className={cn("pb-4 text-sm text-muted", className)}>{children}</div>
    </A.Content>
  );
}
