import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Texto puro com links clicáveis seguros. Nada é interpretado como HTML
 * (React escapa tudo); só viram link URLs http(s) e "www.", abertos em nova
 * aba com rel="noopener noreferrer nofollow".
 */
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"'`]+)/gi;
const TRAILING = /[.,!?;:)\]}'"»]+$/;

export function LinkifiedText({ text, className, linkClassName }: { text: string; className?: string; linkClassName?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    let url = m[0];
    const trail = url.match(TRAILING)?.[0] ?? "";
    if (trail) url = url.slice(0, -trail.length);
    if (start > last) parts.push(text.slice(last, start));
    const href = url.startsWith("www.") ? `https://${url}` : url;
    parts.push(
      <a
        key={start}
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={cn("break-all underline decoration-current/40 underline-offset-2 hover:decoration-current", linkClassName)}
      >
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <span className={cn("break-words whitespace-pre-wrap", className)}>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </span>
  );
}
