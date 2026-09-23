"use client";
import { useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { useUpload } from "@/hooks/use-upload";
import { updateProfileAction } from "@/app/(app)/profile/actions";

type Profile = { name: string; email: string; headline: string | null; phone: string | null; bio: string | null; avatarUrl: string | null };

export function ProfileForm({ profile }: { profile: Profile }) {
  const [form, setForm] = useState({ name: profile.name, headline: profile.headline ?? "", phone: profile.phone ?? "", bio: profile.bio ?? "" });
  const [avatar, setAvatar] = useState<string | null>(profile.avatarUrl);
  const { run, pending, fieldErrors } = useAction(updateProfileAction, { errorToast: true });
  const { upload, uploading, error: uploadError } = useUpload("avatar");
  const dirty =
    form.name !== profile.name || form.headline !== (profile.headline ?? "") || form.phone !== (profile.phone ?? "") || form.bio !== (profile.bio ?? "") || avatar !== profile.avatarUrl;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run({ ...form, avatarUrl: avatar });
      }}
      className="space-y-6"
    >
      <div className="flex items-center gap-5">
        <Avatar name={form.name || profile.name} src={avatar} size="xl" />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" loading={uploading} asChild={false} onClick={() => document.getElementById("avatar-input")?.click()}>
              <Camera /> Alterar foto
            </Button>
            {avatar && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAvatar(null)}>
                <Trash2 /> Remover
              </Button>
            )}
          </div>
          <p className="text-caption text-subtle">JPG, PNG ou WebP, até 3 MB.</p>
          {uploadError && <p className="text-caption text-danger" role="alert">{uploadError}</p>}
          <input
            id="avatar-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                const res = await upload(f);
                if (res) setAvatar(res.url);
              }
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" error={fieldErrors.name} hint="É o nome que aparece nos certificados." required>
          <Input value={form.name} onChange={set("name")} autoComplete="name" />
        </Field>
        <Field label="E-mail" hint="Para alterar o e-mail, fale com a secretaria.">
          <Input value={profile.email} disabled readOnly />
        </Field>
        <Field label="Cargo ou função" error={fieldErrors.headline} hint="Ex.: Líder de pequeno grupo">
          <Input value={form.headline} onChange={set("headline")} />
        </Field>
        <Field label="Telefone" error={fieldErrors.phone}>
          <Input value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" />
        </Field>
      </div>
      <Field label="Sobre você" error={fieldErrors.bio} hint={`${form.bio.length}/600`}>
        <Textarea value={form.bio} onChange={set("bio")} maxLength={600} placeholder="Conte um pouco sobre sua caminhada e ministério." />
      </Field>
      <div className="flex justify-end gap-2 border-t border-border pt-5">
        {dirty && (
          <Button type="button" variant="ghost" onClick={() => { setForm({ name: profile.name, headline: profile.headline ?? "", phone: profile.phone ?? "", bio: profile.bio ?? "" }); setAvatar(profile.avatarUrl); }}>
            Descartar
          </Button>
        )}
        <Button type="submit" loading={pending} disabled={!dirty}>Salvar alterações</Button>
      </div>
    </form>
  );
}
