/**
 * Reconhecimento de links de vídeo externos (isomórfico: editor, servidor e player).
 * Só gera embeds para hosts conhecidos — nada de iframe para endereços arbitrários.
 */

/** Hosts do player do Panda Video: player-<conta>.tv.pandavideo.com.br (e variações regionais). */
const PANDA_HOST = /^player-[a-z0-9-]+\.tv\.pandavideo\.com(\.br)?$/i;

/** Aceita o link de embed/compartilhamento ou o código <iframe> inteiro copiado do painel do Panda. */
export function pandaEmbedUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.includes("<iframe") ? (input.match(/src=["']([^"']+)["']/i)?.[1] ?? "") : input.trim();
  let url: URL;
  try {
    url = new URL(raw.replace(/&amp;/g, "&"));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !PANDA_HOST.test(url.hostname)) return null;
  const id = url.searchParams.get("v");
  if (!id || !/^[\w-]{8,64}$/.test(id)) return null;
  return `https://${url.hostname}/embed/?v=${encodeURIComponent(id)}`;
}

export function youtubeId(url: string) {
  return url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? null;
}

export function vimeoId(url: string) {
  return url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1] ?? null;
}

export type EmbedProvider = "YOUTUBE" | "VIMEO" | "PANDA";

/** Embed do player da aula (com controles). */
export function embedUrl(provider: EmbedProvider, url: string): string | null {
  if (provider === "YOUTUBE") {
    const id = youtubeId(url);
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : null;
  }
  if (provider === "VIMEO") {
    const id = vimeoId(url);
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return pandaEmbedUrl(url);
}

/** Embed para prévia: sem som, automático e em loop. */
export function previewEmbedUrl(provider: EmbedProvider, url: string): string | null {
  if (provider === "YOUTUBE") {
    const id = youtubeId(url);
    return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&modestbranding=1&playsinline=1&rel=0` : null;
  }
  if (provider === "VIMEO") {
    const id = vimeoId(url);
    return id ? `https://player.vimeo.com/video/${id}?background=1&autoplay=1&muted=1&loop=1` : null;
  }
  const base = pandaEmbedUrl(url);
  return base ? `${base}&autoplay=true&muted=true&loop=true&controls=false` : null;
}
