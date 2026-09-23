import { Tag, type LucideIcon } from "lucide-react";
import { ICONS } from "@/components/icon";
import { CATALOG_ICON_KEYS, type CatalogIconKey } from "./icon-keys";

const LABELS: Record<CatalogIconKey, string> = {
  "book-open": "Livro aberto", library: "Biblioteca", landmark: "Templo", church: "Igreja", compass: "Bússola",
  "heart-handshake": "Cuidado", "hand-heart": "Serviço", sprout: "Broto", mic: "Microfone", music: "Música",
  globe: "Mundo", sun: "Sol", flame: "Chama", users: "Pessoas", baby: "Crianças", "messages-square": "Conversa",
  lightbulb: "Ideia", "graduation-cap": "Formação", shield: "Escudo", clock: "Relógio", award: "Prêmio", medal: "Medalha",
  "badge-check": "Selo", star: "Estrela", "calendar-check": "Agenda", footprints: "Passos",
};

export const CATALOG_ICONS = Object.fromEntries(
  CATALOG_ICON_KEYS.map((k) => [k, { Icon: ICONS[k] ?? Tag, label: LABELS[k] }]),
) as Record<CatalogIconKey, { Icon: LucideIcon; label: string }>;

export function CatalogIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && CATALOG_ICONS[name as CatalogIconKey]?.Icon) || Tag;
  return <Icon className={className} aria-hidden />;
}
