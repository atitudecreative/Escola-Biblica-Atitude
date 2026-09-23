"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { controlBase } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CATALOG_ICONS, CatalogIcon } from "./icons";
import { CATALOG_ICON_KEYS } from "./icon-keys";

/** Seletor de ícone a partir da lista curada. */
export function IconPicker({
  value,
  onChange,
  id,
  allowNone = true,
  ...aria
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  id?: string;
  allowNone?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = value ? CATALOG_ICONS[value as keyof typeof CATALOG_ICONS] : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" id={id} {...aria} className={cn(controlBase, "flex h-10 items-center gap-2.5 px-3 text-left text-sm sm:h-9")}>
          <span className="flex size-6 items-center justify-center rounded-md bg-primary-soft text-primary-soft-fg">
            <CatalogIcon name={value} className="size-3.5" />
          </span>
          <span className={cn("flex-1 truncate", !current && "text-subtle")}>{current?.label ?? "Sem ícone"}</span>
          <ChevronDown className="size-4 text-subtle" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-2">
        <div role="listbox" aria-label="Ícones" className="grid grid-cols-6 gap-1">
          {CATALOG_ICON_KEYS.map((k) => {
            const { Icon, label } = CATALOG_ICONS[k];
            const selected = value === k;
            return (
              <button
                key={k}
                type="button"
                role="option"
                aria-selected={selected}
                title={label}
                aria-label={label}
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
                className={cn(
                  "flex size-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg",
                  selected && "bg-primary-soft text-primary-soft-fg ring-1 ring-primary/30",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
          })}
        </div>
        {allowNone && value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="mt-2 h-8 w-full rounded-md text-small text-muted hover:bg-surface-2 hover:text-fg"
          >
            Remover ícone
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
