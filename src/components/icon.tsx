import {
  Award, BookOpen, Clock, Compass, Globe, GraduationCap, HeartHandshake, Landmark, Library, Lightbulb, Medal, Mic,
  MessagesSquare, Music, Shield, Sprout, Star, Sun, Users, Flame, Footprints, BadgeCheck, CalendarCheck, Baby, Church,
  HandHeart, type LucideIcon,
} from "lucide-react";

/** Ícones curados que podem ser escolhidos no CMS (categorias, benefícios, conquistas). */
export const ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen, landmark: Landmark, compass: Compass, "heart-handshake": HeartHandshake, sprout: Sprout,
  mic: Mic, globe: Globe, sun: Sun, clock: Clock, users: Users, award: Award, "graduation-cap": GraduationCap,
  library: Library, lightbulb: Lightbulb, medal: Medal, "messages-square": MessagesSquare, music: Music, shield: Shield,
  star: Star, flame: Flame, footprints: Footprints, "badge-check": BadgeCheck, "calendar-check": CalendarCheck,
  baby: Baby, church: Church, "hand-heart": HandHeart,
};

export function Icon({ name, className }: { name?: string | null; className?: string }) {
  const C = (name && ICONS[name]) || BookOpen;
  return <C className={className} aria-hidden />;
}
