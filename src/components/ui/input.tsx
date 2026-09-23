import * as React from "react";
import { cn } from "@/lib/utils";

export const controlBase =
  "w-full rounded-md border border-border-strong bg-surface text-fg shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-subtle focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/25";

export function Input({ className, type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type={type} className={cn(controlBase, "h-10 px-3 text-sm sm:h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlBase, "min-h-24 px-3 py-2 text-sm leading-relaxed", className)} {...props} />;
}

/** `className` estiliza o contêiner (largura/layout); `selectClassName`, o próprio select (ex.: altura). */
export function NativeSelect({
  className,
  selectClassName,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { selectClassName?: string }) {
  return (
    <div className={cn("relative", className)}>
      <select className={cn(controlBase, "h-10 appearance-none pr-9 pl-3 text-sm sm:h-9", selectClassName)} {...props}>
        {children}
      </select>
      <svg
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
