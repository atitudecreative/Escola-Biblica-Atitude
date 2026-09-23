import { ClipboardList, FileAudio, FileText, Link2, ListChecks, Paperclip, PlayCircle, Presentation, BookText } from "lucide-react";
import type { LessonType } from "@prisma/client";

const MAP = {
  VIDEO: PlayCircle, TEXT: BookText, PDF: FileText, AUDIO: FileAudio, PRESENTATION: Presentation,
  FILE: Paperclip, LINK: Link2, QUIZ: ListChecks, ASSIGNMENT: ClipboardList,
} satisfies Record<LessonType, unknown>;

export function LessonTypeIcon({ type, className }: { type: LessonType; className?: string }) {
  const C = MAP[type];
  return <C className={className} aria-hidden />;
}
