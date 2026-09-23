/**
 * Lista curada de ícones (nomes lucide em kebab-case) usados em categorias e
 * benefícios da home. Espelha as chaves de src/components/icon.tsx (que renderiza
 * os ícones no site público). Isomórfico: serve à validação no servidor e à UI.
 */
export const CATALOG_ICON_KEYS = [
  "book-open", "library", "landmark", "church", "compass", "heart-handshake", "hand-heart", "sprout", "mic", "music",
  "globe", "sun", "flame", "users", "baby", "messages-square", "lightbulb", "graduation-cap", "shield", "clock", "award",
  "medal", "badge-check", "star", "calendar-check", "footprints",
] as const;

export type CatalogIconKey = (typeof CATALOG_ICON_KEYS)[number];
