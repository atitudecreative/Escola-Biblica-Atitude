"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Captions, CaptionsOff, Check, Maximize, Minimize, Pause, PictureInPicture2, Play, RotateCcw, RotateCw, Settings, Volume1, Volume2, VolumeX,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";

/** `alternates`: mesmos vídeo em outros formatos (ex.: WebM) — o navegador escolhe o primeiro que suporta. */
export type VideoSource = { src: string; label: string; type?: string; alternates?: { src: string; type: string }[] };

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const PREF_KEY = "eba.player";

function loadPrefs(): { rate: number; volume: number; captions: boolean } {
  try {
    return { rate: 1, volume: 1, captions: false, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}") };
  } catch {
    return { rate: 1, volume: 1, captions: false };
  }
}
function savePrefs(p: Partial<ReturnType<typeof loadPrefs>>) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ ...loadPrefs(), ...p }));
  } catch {}
}

/**
 * Player HTML5 com controles próprios e acessíveis.
 * Atalhos: Espaço/K play · J/L ±10s · ←/→ ±5s · ↑/↓ volume · M mudo · F tela cheia · C legendas.
 * Emite onProgress(posição, delta assistido) a cada ~15s e onEnded ao terminar.
 */
export function VideoPlayer({
  sources,
  captionsUrl,
  startAt = 0,
  title,
  onProgress,
  onEnded,
}: {
  sources: VideoSource[];
  captionsUrl?: string | null;
  startAt?: number;
  title: string;
  onProgress?: (position: number, delta: number) => void;
  onEnded?: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [captions, setCaptions] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [idle, setIdle] = useState(false);
  const [source, setSource] = useState(0);
  const [error, setError] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [pipSupported, setPipSupported] = useState(false);
  const watched = useRef(0);
  const lastTick = useRef<number | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preferências persistidas (velocidade, volume, legendas).
  useEffect(() => {
    const p = loadPrefs();
    const v = video.current;
    if (v) {
      v.playbackRate = p.rate;
      v.volume = p.volume;
    }
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza estado com preferências salvas no navegador */
    setRate(p.rate);
    setVolume(p.volume);
    setCaptions(p.captions && !!captionsUrl);
    setPipSupported(typeof document !== "undefined" && "pictureInPictureEnabled" in document && document.pictureInPictureEnabled);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [captionsUrl]);

  // Metadados podem carregar antes da hidratação: sincroniza no mount.
  useEffect(() => {
    const v = video.current;
    if (v && v.readyState >= 1 && Number.isFinite(v.duration)) setDuration(v.duration);
  }, []);

  useEffect(() => {
    const track = video.current?.textTracks?.[0];
    if (!track) return;
    track.mode = captions ? "showing" : "hidden";
    // Sobe as legendas para não ficarem atrás dos controles.
    for (const cue of Array.from(track.cues ?? [])) (cue as VTTCue).line = -4;
  }, [captions, duration]);

  const flush = useCallback(() => {
    const v = video.current;
    if (!v || !onProgress) return;
    const delta = Math.round(watched.current);
    watched.current = 0;
    onProgress(v.currentTime, delta);
  }, [onProgress]);

  // Envia progresso periodicamente e ao sair da página.
  useEffect(() => {
    const t = setInterval(() => {
      if (watched.current >= 5) flush();
    }, 15_000);
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrap.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => setError(true));
    else v.pause();
  }, []);

  const seek = useCallback((to: number) => {
    const v = video.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration, to));
  }, []);

  const showFlash = (s: string) => {
    setFlash(s);
    setTimeout(() => setFlash(null), 500);
  };

  const setVol = (val: number) => {
    const v = video.current;
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, val));
    v.muted = v.volume === 0;
    savePrefs({ volume: v.volume });
  };

  const changeRate = (r: number) => {
    if (video.current) video.current.playbackRate = r;
    setRate(r);
    savePrefs({ rate: r });
  };

  const toggleCaptions = () => {
    setCaptions((c) => {
      savePrefs({ captions: !c });
      return !c;
    });
  };

  const toggleFullscreen = async () => {
    if (!wrap.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await wrap.current.requestFullscreen?.().catch(() => undefined);
  };

  const togglePip = async () => {
    const v = video.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {}
  };

  const changeSource = (i: number) => {
    const v = video.current;
    const at = v?.currentTime ?? 0;
    const wasPlaying = v && !v.paused;
    setSource(i);
    requestAnimationFrame(() => {
      const nv = video.current;
      if (!nv) return;
      nv.currentTime = at;
      if (wasPlaying) void nv.play();
    });
  };

  function onKey(e: React.KeyboardEvent) {
    if ((e.target as HTMLElement).closest("input,[role=menu],[role=slider]")) return;
    const v = video.current;
    if (!v) return;
    const k = e.key.toLowerCase();
    const jump = (d: number) => {
      seek(v.currentTime + d);
      showFlash(`${d > 0 ? "+" : "−"}${Math.abs(d)}s`);
    };
    if (k === " " || k === "k") toggle();
    else if (k === "j") jump(-10);
    else if (k === "l") jump(10);
    else if (k === "arrowleft") jump(-5);
    else if (k === "arrowright") jump(5);
    else if (k === "arrowup") setVol(v.volume + 0.1);
    else if (k === "arrowdown") setVol(v.volume - 0.1);
    else if (k === "m") v.muted = !v.muted;
    else if (k === "f") void toggleFullscreen();
    else if (k === "c" && captionsUrl) toggleCaptions();
    else return;
    e.preventDefault();
    poke();
  }

  function poke() {
    setIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), 2600);
  }

  const pct = duration ? (time / duration) * 100 : 0;
  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const controlsHidden = playing && idle;

  return (
    <div
      ref={wrap}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseMove={poke}
      onMouseLeave={() => playing && setIdle(true)}
      role="region"
      aria-label={`Player de vídeo: ${title}`}
      className={cn("group relative aspect-video w-full overflow-hidden bg-black text-white select-none focus-visible:outline-2", controlsHidden && "cursor-none", fullscreen ? "rounded-none" : "rounded-xl")}
    >
      <video
        ref={video}
        key={sources[source]?.src}
        className="size-full"
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration);
          v.playbackRate = rate;
          if (startAt > 3 && startAt < v.duration - 5 && v.currentTime < 1) v.currentTime = startAt;
        }}
        onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setTime(v.currentTime);
          // Conta apenas tempo efetivamente reproduzido (ignora saltos).
          const now = v.currentTime;
          if (lastTick.current != null && !v.paused) {
            const d = now - lastTick.current;
            if (d > 0 && d < 2) watched.current += d / v.playbackRate;
          }
          lastTick.current = now;
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onPlay={() => {
          setPlaying(true);
          poke();
        }}
        onPause={() => {
          setPlaying(false);
          setIdle(false);
          flush();
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onEnded={() => {
          setPlaying(false);
          flush();
          onEnded?.();
        }}
        onError={() => setError(true)}
      >
        <source src={sources[source]?.src} type={sources[source]?.type ?? "video/mp4"} />
        {sources[source]?.alternates?.map((a) => <source key={a.src} src={a.src} type={a.type} />)}
        {captionsUrl && <track kind="subtitles" src={captionsUrl} srcLang="pt-BR" label="Português" default={false} />}
      </video>

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center">
          <p className="font-medium">Não foi possível carregar o vídeo.</p>
          <p className="text-small text-white/70">Verifique sua conexão e tente novamente.</p>
          <button
            onClick={() => {
              setError(false);
              video.current?.load();
            }}
            className="mt-1 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!playing && !error && (
        <button onClick={toggle} className="absolute inset-0 m-auto flex size-18 items-center justify-center rounded-full bg-white/95 text-black shadow-lg transition hover:scale-105" aria-label="Reproduzir">
          <Play className="ml-1 size-7 fill-current" />
        </button>
      )}
      {waiting && playing && <Spinner className="absolute inset-0 m-auto size-9 text-white" label="Carregando vídeo" />}
      {flash && <div className="absolute inset-0 m-auto flex h-10 w-20 items-center justify-center rounded-full bg-black/60 text-sm font-semibold animate-fade-in">{flash}</div>}

      {/* Controles */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pt-12 pb-2 transition-opacity duration-300 sm:px-4",
          controlsHidden ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="group/seek relative flex h-5 items-center">
          <div className="absolute inset-x-0 h-1 rounded-full bg-white/25 transition-[height] group-hover/seek:h-1.5">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/35" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--brand-accent)]" style={{ width: `${pct}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Posição do vídeo"
            aria-valuetext={`${formatClock(time)} de ${formatClock(duration)}`}
            className="absolute inset-x-0 h-5 w-full cursor-pointer opacity-0"
          />
          <div className="pointer-events-none absolute size-3 -translate-x-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover/seek:opacity-100" style={{ left: `${pct}%` }} />
        </div>
        <div className="mt-1 flex items-center gap-0.5 sm:gap-1">
          <CtrlButton label={playing ? "Pausar (K)" : "Reproduzir (K)"} onClick={toggle}>
            {playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          </CtrlButton>
          <CtrlButton label="Voltar 10 segundos (J)" onClick={() => seek(time - 10)} className="hidden sm:flex">
            <RotateCcw />
          </CtrlButton>
          <CtrlButton label="Avançar 10 segundos (L)" onClick={() => seek(time + 10)} className="hidden sm:flex">
            <RotateCw />
          </CtrlButton>
          <div className="group/vol flex items-center">
            <CtrlButton label={muted ? "Ativar som (M)" : "Silenciar (M)"} onClick={() => video.current && (video.current.muted = !video.current.muted)}>
              <VolIcon />
            </CtrlButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVol(Number(e.target.value))}
              aria-label="Volume"
              className="hidden w-0 opacity-0 accent-white transition-[width,opacity] group-hover/vol:w-20 group-hover/vol:opacity-100 focus:w-20 focus:opacity-100 sm:block"
            />
          </div>
          <span className="ml-1 text-caption tabular-nums text-white/85">
            {formatClock(time)} <span className="text-white/50">/ {formatClock(duration)}</span>
          </span>
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {captionsUrl && (
              <CtrlButton label={captions ? "Desativar legendas (C)" : "Ativar legendas (C)"} onClick={toggleCaptions} pressed={captions}>
                {captions ? <Captions /> : <CaptionsOff />}
              </CtrlButton>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-9 items-center gap-1 rounded-md px-2 text-caption font-semibold text-white/90 hover:bg-white/15" aria-label="Configurações do vídeo">
                  <Settings className="size-4" />
                  <span className="tabular-nums">{rate}x</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" container={wrap.current} className="w-48">
                <DropdownMenuLabel>Velocidade</DropdownMenuLabel>
                {SPEEDS.map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => changeRate(s)}>
                    <span className="w-4">{rate === s && <Check className="!text-primary" />}</span>
                    {s === 1 ? "Normal" : `${s}x`}
                  </DropdownMenuItem>
                ))}
                {sources.length > 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Qualidade</DropdownMenuLabel>
                    {sources.map((s, i) => (
                      <DropdownMenuItem key={s.src} onSelect={() => changeSource(i)}>
                        <span className="w-4">{source === i && <Check className="!text-primary" />}</span>
                        {s.label}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {pipSupported && (
              <CtrlButton label="Picture-in-picture" onClick={togglePip} className="hidden sm:flex">
                <PictureInPicture2 />
              </CtrlButton>
            )}
            <CtrlButton label={fullscreen ? "Sair da tela cheia (F)" : "Tela cheia (F)"} onClick={toggleFullscreen}>
              {fullscreen ? <Minimize /> : <Maximize />}
            </CtrlButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function CtrlButton({ label, onClick, children, className, pressed }: { label: string; onClick: () => void; children: React.ReactNode; className?: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn("flex size-9 items-center justify-center rounded-md text-white/90 transition hover:bg-white/15 hover:text-white [&_svg]:size-[18px]", className)}
    >
      {children}
    </button>
  );
}
