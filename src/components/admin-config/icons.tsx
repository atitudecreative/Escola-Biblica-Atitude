import {
  Anchor, Award, Baby, BadgeCheck, BookMarked, BookOpen, CalendarCheck, Church, Clock, Compass, Cross, Crown, Flame, Globe,
  GraduationCap, HandHeart, Handshake, Headphones, Heart, HeartHandshake, Landmark, Languages, Leaf, Library, Lightbulb,
  MessageCircle, Mic, Mountain, Music, PenLine, ScrollText, Shield, Smartphone, Sparkles, Sprout, Star, Sun, Tag, Target,
  Users, Video, type LucideIcon,
} from "lucide-react";
import type { CatalogIconKey } from "./icon-keys";

export const CATALOG_ICONS: Record<CatalogIconKey, { Icon: LucideIcon; label: string }> = {
  "book-open": { Icon: BookOpen, label: "Livro aberto" },
  "book-marked": { Icon: BookMarked, label: "Livro marcado" },
  library: { Icon: Library, label: "Biblioteca" },
  "scroll-text": { Icon: ScrollText, label: "Pergaminho" },
  landmark: { Icon: Landmark, label: "Templo" },
  church: { Icon: Church, label: "Igreja" },
  cross: { Icon: Cross, label: "Cruz" },
  compass: { Icon: Compass, label: "Bússola" },
  "heart-handshake": { Icon: HeartHandshake, label: "Cuidado" },
  "hand-heart": { Icon: HandHeart, label: "Serviço" },
  heart: { Icon: Heart, label: "Coração" },
  sprout: { Icon: Sprout, label: "Broto" },
  leaf: { Icon: Leaf, label: "Folha" },
  mic: { Icon: Mic, label: "Microfone" },
  music: { Icon: Music, label: "Música" },
  globe: { Icon: Globe, label: "Mundo" },
  sun: { Icon: Sun, label: "Sol" },
  flame: { Icon: Flame, label: "Chama" },
  users: { Icon: Users, label: "Pessoas" },
  baby: { Icon: Baby, label: "Crianças" },
  "message-circle": { Icon: MessageCircle, label: "Conversa" },
  lightbulb: { Icon: Lightbulb, label: "Ideia" },
  "graduation-cap": { Icon: GraduationCap, label: "Formação" },
  languages: { Icon: Languages, label: "Idiomas" },
  "pen-line": { Icon: PenLine, label: "Escrita" },
  shield: { Icon: Shield, label: "Escudo" },
  crown: { Icon: Crown, label: "Coroa" },
  anchor: { Icon: Anchor, label: "Âncora" },
  mountain: { Icon: Mountain, label: "Montanha" },
  sparkles: { Icon: Sparkles, label: "Brilho" },
  clock: { Icon: Clock, label: "Relógio" },
  award: { Icon: Award, label: "Prêmio" },
  "badge-check": { Icon: BadgeCheck, label: "Selo" },
  star: { Icon: Star, label: "Estrela" },
  target: { Icon: Target, label: "Alvo" },
  handshake: { Icon: Handshake, label: "Parceria" },
  "calendar-check": { Icon: CalendarCheck, label: "Agenda" },
  video: { Icon: Video, label: "Vídeo" },
  headphones: { Icon: Headphones, label: "Áudio" },
  smartphone: { Icon: Smartphone, label: "Celular" },
};

export function CatalogIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && CATALOG_ICONS[name as CatalogIconKey]?.Icon) || Tag;
  return <Icon className={className} aria-hidden />;
}
