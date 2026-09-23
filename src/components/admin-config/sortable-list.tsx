"use client";
import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lista reordenável: arrastar pela alça (mouse/toque/teclado) ou usar as setas.
 * `onReorder` recebe a nova ordem de IDs.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
  itemClassName,
  disabled,
  label = "item",
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  itemClassName?: string;
  disabled?: boolean;
  label?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map((i) => i.id);

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    onReorder(arrayMove(ids, from, to));
  }
  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    onReorder(arrayMove(ids, index, to));
  }

  return (
    <DndContext id={React.useId()} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item, i) => (
            <SortableRow
              key={item.id}
              id={item.id}
              disabled={disabled}
              className={itemClassName}
              first={i === 0}
              last={i === items.length - 1}
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
              label={label}
            >
              {renderItem(item, i)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
  disabled,
  className,
  first,
  last,
  onUp,
  onDown,
  label,
}: {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  label: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative flex items-center gap-2 bg-surface", isDragging && "z-10 shadow-md", className)}
    >
      <button
        type="button"
        className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg active:cursor-grabbing disabled:opacity-40"
        aria-label={`Arrastar para reordenar ${label}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          onClick={onUp}
          disabled={disabled || first}
          className="flex h-5 w-7 items-center justify-center rounded text-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-30"
          aria-label={`Mover ${label} para cima`}
        >
          <ArrowUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDown}
          disabled={disabled || last}
          className="flex h-5 w-7 items-center justify-center rounded text-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-30"
          aria-label={`Mover ${label} para baixo`}
        >
          <ArrowDown className="size-3.5" />
        </button>
      </div>
    </li>
  );
}
