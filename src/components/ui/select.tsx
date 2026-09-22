"use client";
import * as React from "react";
import { Select as S } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlBase } from "./input";

export type SelectOption = { value: string; label: string; description?: string };

/** Select acessível (Radix). Para formulários simples, prefira <NativeSelect>. */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Selecione",
  className,
  id,
  name,
  disabled,
  "aria-label": ariaLabel,
  ...rest
}: {
  value?: string;
  onValueChange?: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <S.Root value={value} onValueChange={onValueChange} name={name} disabled={disabled}>
      <S.Trigger
        id={id}
        aria-label={ariaLabel}
        {...rest}
        className={cn(controlBase, "flex h-10 items-center justify-between gap-2 px-3 text-sm sm:h-9 data-[placeholder]:text-subtle", className)}
      >
        <S.Value placeholder={placeholder} />
        <S.Icon>
          <ChevronDown className="size-4 text-subtle" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          className="z-[60] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-surface shadow-lg data-[state=open]:animate-scale-in"
        >
          <S.Viewport className="p-1">
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className="relative flex min-h-9 cursor-pointer items-center rounded-md py-1.5 pr-8 pl-2.5 text-sm outline-none select-none data-[highlighted]:bg-surface-2"
              >
                <div>
                  <S.ItemText>{o.label}</S.ItemText>
                  {o.description && <div className="text-caption text-subtle">{o.description}</div>}
                </div>
                <S.ItemIndicator className="absolute right-2.5">
                  <Check className="size-4 text-primary" />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
