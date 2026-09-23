"use client";
import Link from "next/link";
import { useState } from "react";
import { Bookmark, BookmarkCheck, Play, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useAction } from "@/hooks/use-action";
import { enrollAction, reviewCourseAction, toggleFavoriteAction } from "@/app/actions/learning";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function EnrollButton({
  courseId,
  state,
  continueHref,
  loggedIn,
  slug,
  paid,
  className,
  size = "lg",
}: {
  courseId: string;
  state: "none" | "active" | "completed";
  continueHref?: string | null;
  loggedIn: boolean;
  slug: string;
  paid?: boolean;
  className?: string;
  size?: "md" | "lg";
}) {
  const { run, pending, error } = useAction(enrollAction, { errorToast: true });
  if (state !== "none" && continueHref) {
    return (
      <Button asChild size={size} className={className}>
        <Link href={continueHref}>
          <Play className="fill-current" /> {state === "completed" ? "Revisar curso" : "Continuar curso"}
        </Link>
      </Button>
    );
  }
  if (!loggedIn) {
    return (
      <Button asChild size={size} className={className}>
        <Link href={`/login?next=${encodeURIComponent(`/courses/${slug}`)}`}>Começar curso</Link>
      </Button>
    );
  }
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button size={size} loading={pending} onClick={() => run(courseId)} disabled={paid} className="w-full">
        {paid ? "Inscrição indisponível" : "Começar curso"}
      </Button>
      {error && !pending && <p className="text-caption text-danger">{error}</p>}
    </div>
  );
}

export function FavoriteButton({ type, id, initial, variant = "outline", label = true }: { type: "COURSE" | "LESSON" | "MATERIAL"; id: string; initial: boolean; variant?: "outline" | "ghost"; label?: boolean }) {
  const [on, setOn] = useState(initial);
  const { run, pending } = useAction(toggleFavoriteAction, { errorToast: true });
  return (
    <Button
      variant={variant}
      size={label ? "lg" : "icon"}
      aria-pressed={on}
      aria-label={on ? "Remover dos favoritos" : "Salvar nos favoritos"}
      disabled={pending}
      onClick={async () => {
        setOn(!on);
        const res = await run({ type, id });
        if (res && !res.ok) setOn(on);
        else if (res?.ok) toast.success(res.data ? "Salvo nos favoritos" : "Removido dos favoritos");
      }}
    >
      {on ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
      {label && (on ? "Salvo" : "Salvar")}
    </Button>
  );
}

export function ReviewForm({ courseId, initial }: { courseId: string; initial?: { rating: number; comment: string | null } | null }) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const { run, pending, error } = useAction(reviewCourseAction);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return;
        run({ courseId, rating, comment });
      }}
      className="rounded-xl border border-border bg-surface-2/50 p-4"
    >
      <p className="text-h4">{initial ? "Sua avaliação" : "Avalie este curso"}</p>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Nota de 1 a 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className="p-1"
          >
            <Star className={cn("size-6 transition", (hover || rating) >= n ? "fill-accent text-accent" : "text-border-strong")} />
          </button>
        ))}
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Conte o que achou (opcional)" className="mt-3 min-h-20" maxLength={1000} aria-label="Comentário" />
      {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
      <div className="mt-3 flex justify-end">
        <Button type="submit" loading={pending} disabled={!rating}>
          {initial ? "Atualizar avaliação" : "Enviar avaliação"}
        </Button>
      </div>
    </form>
  );
}
