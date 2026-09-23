"use client";
import { useId, useState } from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LessonType } from "@prisma/client";
import {
  ArrowDown, ArrowRightLeft, ArrowUp, Check, Copy, Eye, EyeOff, GripVertical, MoreHorizontal, Pencil, Plus, Trash2, Unlock, Lock, AlertCircle, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LessonTypeIcon } from "@/components/course/lesson-type-icon";
import { useAction } from "@/hooks/use-action";
import {
  createLessonAction, createModuleAction, deleteLessonAction, deleteModuleAction, duplicateLessonAction, duplicateModuleAction,
  previewLessonAction, publishLessonAction, renameModuleAction, reorderAction,
} from "@/app/(app)/teacher/courses/[id]/actions";
import { LESSON_TYPE } from "@/lib/labels";
import { LESSON_TYPES } from "@/lib/validation/teacher";
import { formatDuration, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CurriculumLesson = {
  id: string;
  title: string;
  type: LessonType;
  durationSeconds: number;
  isPreview: boolean;
  isPublished: boolean;
  materials: number;
  questions: number | null;
  hasContent: boolean;
};
export type CurriculumModule = { id: string; title: string; description: string | null; lessons: CurriculumLesson[] };

type Shape = { id: string; lessonIds: string[] }[];
const shape = (mods: CurriculumModule[]): Shape => mods.map((m) => ({ id: m.id, lessonIds: m.lessons.map((l) => l.id) }));
const sameShape = (a: Shape, b: Shape) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Currículo do curso: módulos e aulas com arrastar-e-soltar (mouse, toque e
 * teclado) e botões alternativos de mover. Cada mudança de ordem é salva
 * imediatamente; em caso de erro, a ordem anterior é restaurada.
 */
export function CurriculumEditor({ courseId, initial, coursePublished }: { courseId: string; initial: CurriculumModule[]; coursePublished: boolean }) {
  const dndId = useId();
  const [modules, setModules] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    // Sincroniza com o servidor após refresh (ex.: aula criada/excluída).
    setPrevInitial(initial);
    setModules(initial);
  }
  const [active, setActive] = useState<{ id: UniqueIdentifier; type: "module" | "lesson" } | null>(null);
  const [snapshot, setSnapshot] = useState<CurriculumModule[] | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const reorder = useAction(reorderAction, { errorToast: true });

  const [lessonDialog, setLessonDialog] = useState<{ moduleId: string } | null>(null);
  const [moduleDialog, setModuleDialog] = useState<{ id?: string; title: string; description: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const containerOf = (id: UniqueIdentifier, mods = modules) =>
    mods.find((m) => m.id === id) ?? mods.find((m) => m.lessons.some((l) => l.id === id));

  async function persist(next: CurriculumModule[], previous: CurriculumModule[]) {
    if (sameShape(shape(next), shape(previous))) return;
    setSaving("saving");
    const res = await reorder.run({ courseId, modules: shape(next) });
    if (res?.ok) {
      setSaving("saved");
      setTimeout(() => setSaving((s) => (s === "saved" ? "idle" : s)), 1800);
    } else {
      setSaving("idle");
      setModules(previous);
    }
  }

  function apply(next: CurriculumModule[]) {
    const prev = modules;
    setModules(next);
    void persist(next, prev);
  }

  // ── Arrastar e soltar ──────────────────────────────────────────────
  const collision: CollisionDetection = (args) => {
    const type = args.active.data.current?.type;
    const mods = args.droppableContainers.filter((c) => c.data.current?.type === "module");
    if (type === "module") return closestCenter({ ...args, droppableContainers: mods });
    const lessons = args.droppableContainers.filter((c) => c.data.current?.type === "lesson");
    const overLesson = pointerWithin({ ...args, droppableContainers: lessons });
    if (overLesson.length) return overLesson;
    const overModule = pointerWithin({ ...args, droppableContainers: mods });
    if (overModule.length) return overModule;
    return closestCenter({ ...args, droppableContainers: lessons.length ? lessons : mods });
  };

  function onDragStart(e: DragStartEvent) {
    setActive({ id: e.active.id, type: e.active.data.current?.type });
    setSnapshot(modules);
  }

  function onDragOver({ active: a, over }: DragOverEvent) {
    if (!over || a.data.current?.type !== "lesson") return;
    const from = containerOf(a.id);
    const to = containerOf(over.id);
    if (!from || !to || from.id === to.id) return;
    setModules((mods) => {
      const lesson = from.lessons.find((l) => l.id === a.id);
      if (!lesson) return mods;
      const overIndex = to.lessons.findIndex((l) => l.id === over.id);
      return mods.map((m) => {
        if (m.id === from.id) return { ...m, lessons: m.lessons.filter((l) => l.id !== a.id) };
        if (m.id === to.id) {
          const lessons = [...m.lessons];
          lessons.splice(overIndex < 0 ? lessons.length : overIndex, 0, lesson);
          return { ...m, lessons };
        }
        return m;
      });
    });
  }

  function onDragEnd({ active: a, over }: DragEndEvent) {
    const previous = snapshot ?? modules;
    setActive(null);
    setSnapshot(null);
    let next = modules;
    if (over) {
      if (a.data.current?.type === "module") {
        const i = modules.findIndex((m) => m.id === a.id);
        const j = modules.findIndex((m) => m.id === over.id);
        if (i >= 0 && j >= 0 && i !== j) next = arrayMove(modules, i, j);
      } else {
        const c = containerOf(a.id);
        if (c) {
          const i = c.lessons.findIndex((l) => l.id === a.id);
          const j = c.lessons.findIndex((l) => l.id === over.id);
          if (j >= 0 && i !== j) next = modules.map((m) => (m.id === c.id ? { ...m, lessons: arrayMove(m.lessons, i, j) } : m));
        }
      }
    }
    setModules(next);
    void persist(next, previous);
  }

  function onDragCancel() {
    if (snapshot) setModules(snapshot);
    setActive(null);
    setSnapshot(null);
  }

  // ── Movimentos por botão (alternativa acessível) ──────────────────
  function moveModule(id: string, dir: -1 | 1) {
    const i = modules.findIndex((m) => m.id === id);
    const j = i + dir;
    if (j < 0 || j >= modules.length) return;
    apply(arrayMove(modules, i, j));
  }

  function moveLesson(id: string, dir: -1 | 1) {
    const mi = modules.findIndex((m) => m.lessons.some((l) => l.id === id));
    const m = modules[mi];
    const i = m.lessons.findIndex((l) => l.id === id);
    const j = i + dir;
    if (j >= 0 && j < m.lessons.length) {
      apply(modules.map((x) => (x.id === m.id ? { ...x, lessons: arrayMove(x.lessons, i, j) } : x)));
      return;
    }
    // Nas pontas, a aula passa para o módulo vizinho.
    const target = modules[mi + dir];
    if (!target) return;
    const lesson = m.lessons[i];
    apply(
      modules.map((x) => {
        if (x.id === m.id) return { ...x, lessons: x.lessons.filter((l) => l.id !== id) };
        if (x.id === target.id) return { ...x, lessons: dir === -1 ? [...x.lessons, lesson] : [lesson, ...x.lessons] };
        return x;
      }),
    );
  }

  function moveLessonTo(id: string, moduleId: string) {
    const from = containerOf(id);
    const lesson = from?.lessons.find((l) => l.id === id);
    if (!from || !lesson || from.id === moduleId) return;
    apply(
      modules.map((x) => {
        if (x.id === from.id) return { ...x, lessons: x.lessons.filter((l) => l.id !== id) };
        if (x.id === moduleId) return { ...x, lessons: [...x.lessons, lesson] };
        return x;
      }),
    );
    toast.success(`Aula movida para ${modules.find((m) => m.id === moduleId)?.title}.`);
  }

  const titleOf = (id: UniqueIdentifier) =>
    modules.find((m) => m.id === id)?.title ?? modules.flatMap((m) => m.lessons).find((l) => l.id === id)?.title ?? "item";
  const announcements: Announcements = {
    onDragStart: ({ active: a }) => `Você pegou ${titleOf(a.id)}. Use as setas para mover e Espaço para soltar.`,
    onDragOver: ({ active: a, over }) => (over ? `${titleOf(a.id)} está sobre ${titleOf(over.id)}.` : `${titleOf(a.id)} não está sobre uma área válida.`),
    onDragEnd: ({ active: a, over }) => (over ? `${titleOf(a.id)} foi solto sobre ${titleOf(over.id)}.` : `${titleOf(a.id)} foi solto.`),
    onDragCancel: ({ active: a }) => `Movimento cancelado. ${titleOf(a.id)} voltou à posição original.`,
  };

  const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0);
  const activeModule = active?.type === "module" ? modules.find((m) => m.id === active.id) : null;
  const activeLesson = active?.type === "lesson" ? modules.flatMap((m) => m.lessons).find((l) => l.id === active.id) : null;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-small text-muted">
          {pluralize(modules.length, "módulo", "módulos")} · {pluralize(totalLessons, "aula", "aulas")}
          <span className="hidden sm:inline"> · arraste pelo ícone <GripVertical className="inline size-3.5 align-[-2px]" aria-hidden /> para reordenar</span>
        </p>
        <span aria-live="polite" className="inline-flex h-6 items-center gap-1.5 text-caption text-subtle">
          {saving === "saving" && (
            <>
              <Spinner className="size-3" /> Salvando ordem…
            </>
          )}
          {saving === "saved" && (
            <>
              <Check className="size-3.5 text-success" /> Ordem salva
            </>
          )}
        </span>
      </div>

      {modules.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Comece pelo primeiro módulo"
          description="Módulos agrupam aulas por tema. Crie um e adicione a primeira aula."
          action={<Button onClick={() => setModuleDialog({ title: "", description: "" })}><Plus /> Novo módulo</Button>}
        />
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={collision}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable: "Para reordenar, pressione Espaço ou Enter para pegar o item, use as setas para mover e Espaço ou Enter para soltar. Esc cancela.",
            },
          }}
        >
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-3">
              {modules.map((m, mi) => (
                <ModuleCard
                  key={m.id}
                  module={m}
                  index={mi}
                  total={modules.length}
                  allModules={modules}
                  coursePublished={coursePublished}
                  courseId={courseId}
                  onMove={(dir) => moveModule(m.id, dir)}
                  onMoveLesson={moveLesson}
                  onMoveLessonTo={moveLessonTo}
                  onAddLesson={() => setLessonDialog({ moduleId: m.id })}
                  onRename={() => setModuleDialog({ id: m.id, title: m.title, description: m.description ?? "" })}
                  isFirstLessonGlobal={(id) => modules[0]?.lessons[0]?.id === id}
                  isLastLessonGlobal={(id) => modules.at(-1)?.lessons.at(-1)?.id === id}
                />
              ))}
            </ol>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeModule ? (
              <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-surface px-4 py-3 shadow-lg">
                <GripVertical className="size-4 text-subtle" />
                <span className="text-sm font-medium">{activeModule.title}</span>
                <span className="text-caption text-subtle">{pluralize(activeModule.lessons.length, "aula", "aulas")}</span>
              </div>
            ) : activeLesson ? (
              <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-surface px-3 py-2.5 shadow-lg">
                <GripVertical className="size-4 text-subtle" />
                <LessonTypeIcon type={activeLesson.type} className="size-4 text-muted" />
                <span className="truncate text-sm">{activeLesson.title}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {modules.length > 0 && (
        <button
          type="button"
          onClick={() => setModuleDialog({ title: "", description: "" })}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong text-sm font-medium text-muted transition-colors hover:border-primary hover:bg-primary-soft/40 hover:text-primary"
        >
          <Plus className="size-4" /> Novo módulo
        </button>
      )}

      <NewLessonDialog courseId={courseId} target={lessonDialog} onClose={() => setLessonDialog(null)} coursePublished={coursePublished} />
      <ModuleDialog courseId={courseId} value={moduleDialog} onClose={() => setModuleDialog(null)} />
    </div>
  );
}

// ── Módulo ───────────────────────────────────────────────────────────

function ModuleCard({
  module: m, index, total, allModules, coursePublished, courseId, onMove, onMoveLesson, onMoveLessonTo, onAddLesson, onRename, isFirstLessonGlobal, isLastLessonGlobal,
}: {
  module: CurriculumModule;
  index: number;
  total: number;
  allModules: CurriculumModule[];
  coursePublished: boolean;
  courseId: string;
  onMove: (dir: -1 | 1) => void;
  onMoveLesson: (id: string, dir: -1 | 1) => void;
  onMoveLessonTo: (id: string, moduleId: string) => void;
  onAddLesson: () => void;
  onRename: () => void;
  isFirstLessonGlobal: (id: string) => boolean;
  isLastLessonGlobal: (id: string) => boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: m.id, data: { type: "module" } });
  const confirm = useConfirm();
  const del = useAction(deleteModuleAction, { errorToast: true });
  const dup = useAction(duplicateModuleAction, { errorToast: true });
  const duration = m.lessons.filter((l) => l.isPublished).reduce((n, l) => n + l.durationSeconds, 0);

  async function remove() {
    const ok = await confirm({
      title: `Excluir o módulo “${m.title}”?`,
      description: m.lessons.length
        ? `As ${pluralize(m.lessons.length, "aula", "aulas")} deste módulo, seus materiais, avaliações e o progresso dos alunos nelas serão excluídos. Esta ação não pode ser desfeita.`
        : "O módulo está vazio. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir módulo",
    });
    if (ok) del.run({ id: m.id });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("rounded-xl border border-border bg-surface shadow-xs", isDragging && "opacity-40")}
      aria-label={`Módulo ${index + 1}: ${m.title}`}
    >
      <div className="flex items-center gap-1.5 border-b border-border py-2.5 pr-2 pl-1.5 sm:gap-2 sm:pr-3">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg active:cursor-grabbing"
          aria-label={`Arrastar módulo ${m.title}`}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-overline text-subtle">Módulo {index + 1}</p>
          <h3 className="truncate text-sm font-semibold text-fg">{m.title}</h3>
        </div>
        <span className="hidden shrink-0 text-caption text-subtle sm:inline">
          {pluralize(m.lessons.length, "aula", "aulas")}
          {duration > 0 && ` · ${formatDuration(duration)}`}
        </span>
        <Button variant="ghost" size="sm" onClick={onAddLesson} className="shrink-0">
          <Plus /> <span className="hidden sm:inline">Aula</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Ações do módulo ${m.title}`} className="shrink-0">
              {del.pending || dup.pending ? <Spinner /> : <MoreHorizontal />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onRename}><Pencil /> Renomear</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => dup.run({ id: m.id })}><Copy /> Duplicar módulo</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}><ArrowUp /> Mover para cima</DropdownMenuItem>
            <DropdownMenuItem disabled={index === total - 1} onSelect={() => onMove(1)}><ArrowDown /> Mover para baixo</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem tone="danger" disabled={total <= 1} onSelect={remove}><Trash2 /> Excluir módulo</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SortableContext items={m.lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <ol className="divide-y divide-border">
          {m.lessons.map((l, li) => (
            <LessonRow
              key={l.id}
              lesson={l}
              moduleId={m.id}
              courseId={courseId}
              index={li}
              modules={allModules}
              coursePublished={coursePublished}
              canUp={!isFirstLessonGlobal(l.id)}
              canDown={!isLastLessonGlobal(l.id)}
              onMove={(dir) => onMoveLesson(l.id, dir)}
              onMoveTo={(mid) => onMoveLessonTo(l.id, mid)}
            />
          ))}
        </ol>
      </SortableContext>
      {m.lessons.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <p className="text-small text-muted">Nenhuma aula neste módulo. Arraste uma aula para cá ou crie uma nova.</p>
          <Button variant="outline" size="sm" onClick={onAddLesson}><Plus /> Adicionar aula</Button>
        </div>
      )}
    </li>
  );
}

// ── Aula ─────────────────────────────────────────────────────────────

function LessonRow({
  lesson: l, moduleId, courseId, index, modules, coursePublished, canUp, canDown, onMove, onMoveTo,
}: {
  lesson: CurriculumLesson;
  moduleId: string;
  courseId: string;
  index: number;
  modules: CurriculumModule[];
  coursePublished: boolean;
  canUp: boolean;
  canDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onMoveTo: (moduleId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: l.id, data: { type: "lesson", moduleId } });
  const confirm = useConfirm();
  const publish = useAction(publishLessonAction, { errorToast: true });
  const preview = useAction(previewLessonAction, { errorToast: true });
  const dup = useAction(duplicateLessonAction, { errorToast: true });
  const del = useAction(deleteLessonAction, { errorToast: true });
  const busy = publish.pending || preview.pending || dup.pending || del.pending;
  const href = `/teacher/courses/${courseId}/lessons/${l.id}`;

  async function togglePublish() {
    if (l.isPublished && coursePublished) {
      const ok = await confirm({
        title: "Despublicar esta aula?",
        description: "Os alunos deixam de vê-la imediatamente e o progresso do curso é recalculado.",
        confirmLabel: "Despublicar",
        tone: "primary",
      });
      if (!ok) return;
    }
    publish.run({ id: l.id, value: !l.isPublished });
  }

  async function remove() {
    const ok = await confirm({
      title: `Excluir a aula “${l.title}”?`,
      description: "O conteúdo, os materiais, as avaliações e o progresso dos alunos nesta aula serão excluídos. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir aula",
    });
    if (ok) del.run({ id: l.id });
  }

  const meta = [
    LESSON_TYPE[l.type],
    l.durationSeconds > 0 ? formatDuration(l.durationSeconds) : null,
    l.questions != null ? pluralize(l.questions, "questão", "questões") : null,
    l.materials ? pluralize(l.materials, "material", "materiais") : null,
  ].filter(Boolean);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group flex items-center gap-1.5 py-1.5 pr-2 pl-1.5 sm:gap-2 sm:pr-3", isDragging && "opacity-40")}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-subtle opacity-70 hover:bg-surface-2 hover:text-fg hover:opacity-100 active:cursor-grabbing"
        aria-label={`Arrastar aula ${l.title}`}
      >
        <GripVertical className="size-4" />
      </button>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", l.isPublished ? "bg-surface-2 text-muted" : "bg-surface-2/60 text-subtle")}>
        <LessonTypeIcon type={l.type} className="size-4" />
      </span>
      <Link href={href} className="min-w-0 flex-1 py-1.5">
        <span className={cn("block truncate text-sm group-hover:text-primary", l.isPublished ? "text-fg" : "text-muted")}>
          <span className="mr-1.5 text-subtle tabular-nums">{index + 1}.</span>
          {l.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-caption text-subtle">
          {meta.join(" · ")}
          {!l.hasContent && (
            <span className="inline-flex items-center gap-1 text-warning">
              <AlertCircle className="size-3" /> sem conteúdo
            </span>
          )}
        </span>
      </Link>
      <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
        {l.isPreview && <Badge tone="accent">Prévia</Badge>}
        {!l.isPublished && <Badge>Rascunho</Badge>}
      </div>
      <Tooltip content={l.isPublished ? "Despublicar" : "Publicar"}>
        <Button variant="ghost" size="icon-sm" onClick={togglePublish} aria-label={l.isPublished ? `Despublicar ${l.title}` : `Publicar ${l.title}`} className="shrink-0" disabled={busy}>
          {publish.pending ? <Spinner /> : l.isPublished ? <Eye className="text-success" /> : <EyeOff />}
        </Button>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações da aula ${l.title}`} className="shrink-0" disabled={busy && !publish.pending}>
            {dup.pending || del.pending || preview.pending ? <Spinner /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuItem asChild>
            <Link href={href}><Pencil /> Editar aula</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={togglePublish}>{l.isPublished ? <><EyeOff /> Despublicar</> : <><Eye /> Publicar</>}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => preview.run({ id: l.id, value: !l.isPreview })}>
            {l.isPreview ? <><Lock /> Remover prévia gratuita</> : <><Unlock /> Marcar como prévia gratuita</>}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => dup.run({ id: l.id })}><Copy /> Duplicar</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!canUp} onSelect={() => onMove(-1)}><ArrowUp /> Mover para cima</DropdownMenuItem>
          <DropdownMenuItem disabled={!canDown} onSelect={() => onMove(1)}><ArrowDown /> Mover para baixo</DropdownMenuItem>
          {modules.length > 1 && (
            <>
              <DropdownMenuLabel className="flex items-center gap-1.5"><ArrowRightLeft className="size-3" /> Mover para o módulo</DropdownMenuLabel>
              {modules
                .filter((m) => m.id !== moduleId)
                .map((m) => (
                  <DropdownMenuItem key={m.id} onSelect={() => onMoveTo(m.id)} className="pl-7">
                    <span className="truncate">{m.title}</span>
                  </DropdownMenuItem>
                ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem tone="danger" onSelect={remove}><Trash2 /> Excluir aula</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

// ── Diálogos ─────────────────────────────────────────────────────────

function NewLessonDialog({ courseId, target, onClose, coursePublished }: { courseId: string; target: { moduleId: string } | null; onClose: () => void; coursePublished: boolean }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof LESSON_TYPES)[number]>("VIDEO");
  const { run, pending, error, fieldErrors } = useAction(createLessonAction);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run({ courseId, moduleId: target?.moduleId, title, type });
    if (res?.ok) {
      setTitle("");
      setType("VIDEO");
      onClose();
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Nova aula"
        description={coursePublished ? "Como o curso já está publicado, a aula começa como rascunho. Publique quando estiver pronta; os alunos serão avisados." : "Dê um título e escolha o formato. Você completa o conteúdo no editor da aula."}
        footer={
          <>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="new-lesson" loading={pending}>Criar aula</Button>
          </>
        }
      >
        <form id="new-lesson" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && !Object.keys(fieldErrors).length && <Alert tone="danger">{error}</Alert>}
          <Field label="Título" required error={fieldErrors.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Ex.: Introdução ao livro de Atos" autoFocus />
          </Field>
          <fieldset>
            <legend className="mb-2 text-small font-medium">Formato</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LESSON_TYPES.map((t) => (
                <label
                  key={t}
                  className={cn(
                    "flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-small transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
                    type === t ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border hover:bg-surface-2",
                  )}
                >
                  <input type="radio" name="lesson-type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                  <LessonTypeIcon type={t} className="size-4 shrink-0" />
                  {LESSON_TYPE[t]}
                </label>
              ))}
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModuleDialog({ courseId, value, onClose }: { courseId: string; value: { id?: string; title: string; description: string } | null; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setTitle(value?.title ?? "");
    setDescription(value?.description ?? "");
  }
  const create = useAction(createModuleAction);
  const rename = useAction(renameModuleAction);
  const a = value?.id ? rename : create;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = value?.id ? await rename.run({ moduleId: value.id, title, description }) : await create.run({ courseId, title, description });
    if (res?.ok) onClose();
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={value?.id ? "Editar módulo" : "Novo módulo"}
        footer={
          <>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="module-form" loading={a.pending}>{value?.id ? "Salvar" : "Criar módulo"}</Button>
          </>
        }
      >
        <form id="module-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {a.error && !Object.keys(a.fieldErrors).length && <Alert tone="danger">{a.error}</Alert>}
          <Field label="Nome do módulo" required error={a.fieldErrors.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ex.: Os Evangelhos Sinóticos" autoFocus />
          </Field>
          <Field label="Descrição" hint="Opcional. Aparece na página do curso." error={a.fieldErrors.description}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

