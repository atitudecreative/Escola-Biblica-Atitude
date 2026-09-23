"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Award, CheckCircle2, Download, ExternalLink, FileText, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { VideoPlayer } from "./video-player";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { completeLessonAction, recordProgressAction } from "@/app/learn/actions";
import { formatBytes } from "@/lib/format";

type Next = { id: string; title: string; locked?: boolean } | null;

/** Estado de conclusão compartilhado: botão manual, conclusão automática e celebração do curso. */
function useCompletion(lessonId: string, courseId: string, initial: boolean, enrolled: boolean, certificateEnabled: boolean) {
  const router = useRouter();
  const [completed, setCompleted] = useState(initial);
  const [pending, setPending] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  // Mantém em sincronia quando outro componente (ex.: fim do vídeo) conclui a aula.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- espelha prop vinda do servidor/pai
  useEffect(() => { if (initial) setCompleted(true); }, [initial]);
  const complete = useCallback(async () => {
    if (!enrolled || completed) return completed;
    setPending(true);
    const res = await completeLessonAction(lessonId);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setCompleted(true);
    if (res.data?.courseCompleted) setCelebrate(true);
    else if (!res.data?.alreadyCompleted) toast.success("Aula concluída");
    router.refresh();
    return true;
  }, [completed, enrolled, lessonId, router]);

  const celebration = (
    <Dialog open={celebrate} onOpenChange={setCelebrate}>
      <DialogContent title="Parabéns, você concluiu o curso!" description="Todo o conteúdo foi finalizado." size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCelebrate(false)}>Continuar aqui</Button>
            <Button asChild>
              <Link href={certificateEnabled ? "/certificates" : "/my-courses"}>
                {certificateEnabled ? <><Award /> Ver meu certificado</> : "Meus cursos"}
              </Link>
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center py-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
            <PartyPopper className="size-7" />
          </span>
          <p className="mt-4 text-sm text-muted">
            {certificateEnabled ? "Seu certificado já foi emitido e pode ser validado publicamente pelo código ou QR Code." : "Que tal avaliar o curso e contar como foi sua experiência?"}
          </p>
          <Link href={`/courses`} className="mt-2 text-small text-primary hover:underline">Descobrir o próximo curso</Link>
        </div>
      </DialogContent>
    </Dialog>
  );
  void courseId;
  return { completed, pending, complete, celebration };
}

export function CompleteBar({
  lessonId, courseId, completed: initial, enrolled, next, certificateEnabled, label = "Marcar como concluída",
}: { lessonId: string; courseId: string; completed: boolean; enrolled: boolean; next: Next; certificateEnabled: boolean; label?: string }) {
  const { completed, pending, complete, celebration } = useCompletion(lessonId, courseId, initial, enrolled, certificateEnabled);
  const router = useRouter();
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
      {completed ? (
        <p className="flex flex-1 items-center gap-2 text-sm font-medium text-success">
          <CheckCircle2 className="size-5" /> Aula concluída
        </p>
      ) : (
        <p className="flex-1 text-sm text-muted">{enrolled ? "Terminou o conteúdo? Registre seu progresso." : "Matricule-se para registrar seu progresso."}</p>
      )}
      <div className="flex gap-2">
        {!completed && enrolled && (
          <Button variant={next ? "outline" : "primary"} loading={pending} onClick={complete}>
            <CheckCircle2 /> {label}
          </Button>
        )}
        {next && (
          <Button
            onClick={async () => {
              if (!completed && enrolled) {
                const ok = await complete();
                if (!ok) return;
              }
              router.push(`/learn/${courseId}/${next.id}`);
            }}
            disabled={pending}
          >
            {completed || !enrolled ? "Próxima aula" : "Concluir e avançar"} <ArrowRight />
          </Button>
        )}
      </div>
      {celebration}
    </div>
  );
}

export function VideoLesson({
  lessonId, courseId, title, src, provider, captionsUrl, resumeAt, completed: initial, enrolled, next, certificateEnabled,
}: {
  lessonId: string; courseId: string; title: string; src: string; provider: "UPLOAD" | "URL" | "YOUTUBE" | "VIMEO";
  captionsUrl: string | null; resumeAt: number; completed: boolean; enrolled: boolean; next: Next; certificateEnabled: boolean;
}) {
  const router = useRouter();
  const { completed, complete, celebration } = useCompletion(lessonId, courseId, initial, enrolled, certificateEnabled);
  const [countdown, setCountdown] = useState<number | null>(null);

  const onProgress = useCallback(
    (position: number, delta: number) => {
      if (enrolled) void recordProgressAction({ lessonId, position, delta });
    },
    [enrolled, lessonId],
  );

  const onEnded = useCallback(async () => {
    await complete();
    if (next) setCountdown(6);
  }, [complete, next]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      router.push(`/learn/${courseId}/${next!.id}`);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, courseId, next, router]);

  if (provider === "YOUTUBE" || provider === "VIMEO") {
    const embed = embedUrl(provider, src);
    return (
      <div className="space-y-4">
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          {embed ? (
            <iframe src={embed} title={title} className="size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
          ) : (
            <p className="flex size-full items-center justify-center text-sm text-white/80">Link de vídeo inválido.</p>
          )}
        </div>
        <p className="text-caption text-subtle">Vídeos externos não informam o progresso automaticamente — marque a aula como concluída ao terminar.</p>
        <CompleteBar lessonId={lessonId} courseId={courseId} completed={completed} enrolled={enrolled} next={next} certificateEnabled={certificateEnabled} />
        {celebration}
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
      <VideoPlayer sources={[{ src, label: "Original", alternates: /^\/demo\/.+\.mp4$/.test(src) ? [{ src: src.replace(/\.mp4$/, ".webm"), type: "video/webm" }] : undefined }]} captionsUrl={captionsUrl} startAt={completed ? 0 : resumeAt} title={title} onProgress={onProgress} onEnded={onEnded} />
      {countdown !== null && next && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-xl bg-black/80 p-6 text-center text-white animate-fade-in">
          <p className="text-small text-white/70">Próxima aula em {countdown}s</p>
          <p className="max-w-md text-h3">{next.title}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCountdown(null)}>Cancelar</Button>
            <Button onClick={() => router.push(`/learn/${courseId}/${next.id}`)}>Assistir agora <ArrowRight /></Button>
          </div>
        </div>
      )}
      </div>
      <div className="mt-4">
        <CompleteBar lessonId={lessonId} courseId={courseId} completed={completed} enrolled={enrolled} next={next} certificateEnabled={certificateEnabled} />
      </div>
      {celebration}
    </div>
  );
}

export function AudioLesson({ lessonId, src, enrolled }: { lessonId: string; src: string; enrolled: boolean }) {
  const last = useRef(0);
  const acc = useRef(0);
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <audio
        controls
        preload="metadata"
        src={src}
        className="w-full"
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          const d = t - last.current;
          if (d > 0 && d < 2) acc.current += d;
          last.current = t;
          if (enrolled && acc.current >= 15) {
            void recordProgressAction({ lessonId, position: t, delta: Math.round(acc.current) });
            acc.current = 0;
          }
        }}
      >
        Seu navegador não suporta áudio.
      </audio>
    </div>
  );
}

export function DocumentLesson({ file, inlinePdf }: { file: { id: string; originalName: string; mimeType: string; sizeBytes: number }; inlinePdf: boolean }) {
  return (
    <div className="space-y-3">
      {inlinePdf && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
          <iframe src={`/api/files/${file.id}#view=FitH`} title={file.originalName} className="h-[70dvh] w-full" />
        </div>
      )}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary"><FileText className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.originalName}</p>
          <p className="text-caption text-subtle">{file.mimeType.split("/").pop()?.toUpperCase()} · {formatBytes(file.sizeBytes)}</p>
        </div>
        <Button asChild variant="outline">
          <a href={`/api/files/${file.id}?download=1`}><Download /> Baixar</a>
        </Button>
      </div>
    </div>
  );
}

export function LinkLesson({ url }: { url: string }) {
  const safe = /^https?:\/\//.test(url) ? url : null;
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-6">
      <ExternalLink className="size-5 text-primary" />
      <p className="text-sm text-muted">Esta aula usa um conteúdo externo. Ele abrirá em uma nova aba.</p>
      {safe ? (
        <Button asChild>
          <a href={safe} target="_blank" rel="noopener noreferrer nofollow">Abrir conteúdo <ExternalLink /></a>
        </Button>
      ) : (
        <p className="text-small text-danger">Link indisponível.</p>
      )}
    </div>
  );
}

function embedUrl(provider: "YOUTUBE" | "VIMEO", url: string) {
  if (provider === "YOUTUBE") {
    const id = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1];
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : null;
  }
  const id = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];
  return id ? `https://player.vimeo.com/video/${id}` : null;
}
