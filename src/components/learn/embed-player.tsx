"use client";
import { useEffect, useRef, useState } from "react";
import { Watermark } from "./watermark";

type Provider = "YOUTUBE" | "VIMEO" | "PANDA";

const ORIGINS: Record<Provider, RegExp> = {
  YOUTUBE: /^https:\/\/www\.youtube(-nocookie)?\.com$/,
  VIMEO: /^https:\/\/player\.vimeo\.com$/,
  PANDA: /^https:\/\/player-[a-z0-9-]+\.tv\.pandavideo\.com(\.br)?$/i,
};

function parse(data: unknown): Record<string, unknown> | null {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

/**
 * Vídeo externo (YouTube/Vimeo/Panda) com medição de quanto foi assistido pela API
 * de mensagens de cada player. O endereço só é montado no navegador (não vai no HTML
 * da página) e avanços além do já assistido são desfeitos quando o player permite.
 * Sem resposta da API, conta o tempo com o vídeo em foco e a aba visível.
 */
export function EmbedPlayer({
  provider,
  src,
  title,
  onTime,
  onEnded,
  clampSeek,
  watermark,
}: {
  provider: Provider;
  src: string;
  title: string;
  onTime: (position: number, playing: boolean, duration?: number) => void;
  onEnded: () => void;
  clampSeek?: (to: number) => number;
  watermark?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  const alive = useRef(false);
  const last = useRef(0);
  const cbs = useRef({ onTime, onEnded, clampSeek });
  useEffect(() => {
    cbs.current = { onTime, onEnded, clampSeek };
  });

  // Monta o src só no cliente, com a API de mensagens ligada.
  useEffect(() => {
    const u = new URL(src);
    if (provider === "YOUTUBE") {
      u.searchParams.set("enablejsapi", "1");
      u.searchParams.set("origin", window.location.origin);
      u.searchParams.set("playsinline", "1");
    }
    if (provider === "VIMEO") u.searchParams.set("dnt", "1");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- endereço depende de window (origem)
    setUrl(u.toString());
  }, [provider, src]);

  const post = (msg: unknown) => {
    const w = frame.current?.contentWindow;
    if (!w || !url) return;
    w.postMessage(provider === "PANDA" ? msg : JSON.stringify(msg), new URL(url).origin);
  };

  const seekTo = (t: number) => {
    if (provider === "YOUTUBE") post({ event: "command", func: "seekTo", args: [t, true] });
    else if (provider === "VIMEO") post({ method: "setCurrentTime", value: t });
    else post({ type: "currentTime", parameter: t });
  };

  useEffect(() => {
    if (!url) return;
    const handle = (time: number, playing: boolean, duration?: number) => {
      alive.current = true;
      const clamp = cbs.current.clampSeek;
      if (clamp && time > last.current + 3) {
        const allowed = clamp(time);
        if (allowed < time - 1) {
          seekTo(allowed);
          last.current = allowed;
          setNotice(true);
          setTimeout(() => setNotice(false), 1800);
          return;
        }
      }
      last.current = time;
      cbs.current.onTime(time, playing, duration);
    };
    const onMessage = (e: MessageEvent) => {
      if (!ORIGINS[provider].test(e.origin) || e.source !== frame.current?.contentWindow) return;
      const d = parse(e.data);
      if (!d) return;
      if (provider === "YOUTUBE") {
        const info = d.info as { currentTime?: number; duration?: number; playerState?: number } | undefined;
        if (d.event === "infoDelivery" && info) {
          if (typeof info.currentTime === "number") handle(info.currentTime, info.playerState === 1 || info.playerState === undefined, info.duration);
          if (info.playerState === 0) cbs.current.onEnded();
        }
      } else if (provider === "VIMEO") {
        if (d.event === "ready") {
          post({ method: "addEventListener", value: "timeupdate" });
          post({ method: "addEventListener", value: "ended" });
        }
        const data = d.data as { seconds?: number; duration?: number } | undefined;
        if (d.event === "timeupdate" && typeof data?.seconds === "number") handle(data.seconds, true, data.duration);
        if (d.event === "ended") cbs.current.onEnded();
      } else {
        if (d.message === "panda_timeupdate" && typeof d.currentTime === "number") {
          const dur = (d.duration as number | undefined) ?? ((d.playerData as { duration?: number } | undefined)?.duration);
          handle(d.currentTime, true, typeof dur === "number" ? dur : undefined);
        }
        if (d.message === "panda_ended") cbs.current.onEnded();
      }
    };
    window.addEventListener("message", onMessage);

    // Sem API respondendo: conta 1s por segundo com o vídeo em foco (o clique no player move o foco para ele).
    let fallbackTime = 0;
    const started = Date.now();
    const fb = setInterval(() => {
      if (alive.current || Date.now() - started < 15_000) return;
      const watching = document.visibilityState === "visible" && document.activeElement === frame.current;
      if (watching) fallbackTime += 1;
      cbs.current.onTime(fallbackTime, watching);
    }, 1000);

    return () => {
      window.removeEventListener("message", onMessage);
      clearInterval(fb);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- post/seekTo dependem só de url/provider
  }, [url, provider]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-black select-none" onContextMenu={(e) => e.preventDefault()}>
      {url && (
        <iframe
          ref={frame}
          src={url}
          title={title}
          className="size-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => provider === "YOUTUBE" && post({ event: "listening", id: 1, channel: "widget" })}
        />
      )}
      {watermark && <Watermark text={watermark} />}
      {notice && (
        <div className="pointer-events-none absolute inset-x-0 top-4 mx-auto w-fit rounded-full bg-black/75 px-4 py-2 text-sm font-medium text-white">
          Assista para avançar
        </div>
      )}
    </div>
  );
}
