import Link from "next/link";
import { Logo } from "@/components/brand";

type Footer = { text: string; links: { label: string; href: string }[]; instagram: string; youtube: string };

function Social({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex size-9 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 hover:text-fg">
      {children}
    </a>
  );
}

export function PublicFooter({ brand, footer, email, phone }: { brand: { name: string; logoUrl: string | null; tagline: string }; footer: Footer; email: string; phone: string }) {
  const safe = (u: string) => (/^https:\/\//.test(u) ? u : null);
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="max-w-sm">
          <Logo name={brand.name} logoUrl={brand.logoUrl} />
          <p className="mt-4 text-sm text-muted">{brand.tagline}</p>
          <p className="mt-2 text-small text-subtle">{footer.text}</p>
          <div className="mt-4 flex gap-1">
            {safe(footer.instagram) && (
              <Social href={footer.instagram} label="Instagram">
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>
              </Social>
            )}
            {safe(footer.youtube) && (
              <Social href={footer.youtube} label="YouTube">
                <svg viewBox="0 0 24 24" className="size-4" fill="currentColor"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" /></svg>
              </Social>
            )}
          </div>
        </div>
        <div>
          <p className="text-overline text-subtle">Navegação</p>
          <ul className="mt-3 space-y-2">
            {footer.links.map((l) => (
              <li key={l.href + l.label}>
                <Link href={l.href} className="text-sm text-muted transition hover:text-fg">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-overline text-subtle">Contato</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {email && (
              <li>
                <a href={`mailto:${email}`} className="hover:text-fg">{email}</a>
              </li>
            )}
            {phone && <li>{phone}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-5 text-caption text-subtle sm:px-6 lg:px-8">
          © {new Date().getFullYear()} {brand.name}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
