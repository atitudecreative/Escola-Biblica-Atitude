import type { Metadata } from "next";
import Link from "next/link";
import { Award, Lock, Settings } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { getProfile } from "@/server/services/profile";
import { levelFromXp } from "@/server/services/gamification";
import { db } from "@/server/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/profile/profile-form";
import { Icon } from "@/components/icon";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const user = await requireUserPage();
  const [profile, achievements, owned, certificates, completed] = await Promise.all([
    getProfile(user.id),
    db.achievement.findMany({ where: { isActive: true }, orderBy: { xp: "asc" } }),
    db.userAchievement.findMany({ where: { userId: user.id } }),
    db.certificate.count({ where: { userId: user.id, revokedAt: null } }),
    db.enrollment.count({ where: { userId: user.id, status: "COMPLETED" } }),
  ]);
  const level = levelFromXp(profile.xp);
  const ownedMap = new Map(owned.map((o) => [o.achievementId, o.awardedAt]));

  return (
    <>
      <PageHeader
        title="Meu perfil"
        description={`Membro desde ${formatDate(profile.createdAt, "MMMM 'de' yyyy")}`}
        actions={<Button asChild variant="outline"><Link href="/profile/settings"><Settings /> Preferências e segurança</Link></Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Informações pessoais" description="Essas informações aparecem para professores e na comunidade." />
          <CardBody><ProfileForm profile={profile} /></CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardBody className="pt-5">
              <p className="text-overline text-subtle">Seu nível</p>
              <p className="mt-2 text-h1">Nível {level.level}</p>
              <Progress value={level.progress} tone="accent" className="mt-3" label="Progresso do nível" />
              <p className="mt-2 text-caption text-subtle tabular-nums">{formatNumber(profile.xp)} XP · próximo nível em {formatNumber(level.nextAt)} XP</p>
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
                <div><dt className="text-caption text-subtle">Cursos concluídos</dt><dd className="text-h3">{completed}</dd></div>
                <div><dt className="text-caption text-subtle">Certificados</dt><dd className="text-h3">{certificates}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {profile.roles.map((r) => <Badge key={r.role.key} tone="primary">{r.role.name}</Badge>)}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <section id="conquistas" className="mt-10 scroll-mt-24">
        <h2 className="text-h2">Conquistas</h2>
        <p className="mt-1 text-sm text-muted">{owned.length} de {achievements.length} desbloqueadas</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {achievements.map((a) => {
            const at = ownedMap.get(a.id);
            return (
              <li key={a.id} className={`flex items-start gap-3 rounded-xl border p-4 ${at ? "border-border bg-surface" : "border-dashed border-border-strong"}`}>
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${at ? "bg-accent-soft text-accent-soft-fg" : "bg-surface-2 text-subtle"}`}>
                  {at ? <Icon name={a.icon} className="size-5" /> : <Lock className="size-4" />}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${at ? "" : "text-muted"}`}>{a.name}</p>
                  <p className="text-caption text-subtle">{a.description}</p>
                  <p className="mt-1 text-caption text-subtle">{at ? `Desbloqueada em ${formatDate(at, "dd/MM/yyyy")}` : `+${a.xp} XP`}</p>
                </div>
              </li>
            );
          })}
        </ul>
        {certificates > 0 && (
          <Button asChild variant="link" className="mt-4"><Link href="/certificates"><Award /> Ver meus certificados</Link></Button>
        )}
      </section>
    </>
  );
}
