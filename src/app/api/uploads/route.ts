import { NextResponse } from "next/server";
import { z } from "zod";
import { assertUser } from "@/server/auth/guards";
import { saveUpload, UPLOAD_POLICIES, type UploadPurpose } from "@/server/storage";
import { assertSameOrigin, jsonError } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { ForbiddenError, ValidationError } from "@/server/errors";
import type { Permission } from "@/lib/permissions";

/**
 * POST /api/uploads  (multipart: file, purpose)
 * Cada finalidade exige uma permissão; o arquivo é validado (tipo, extensão,
 * assinatura binária e tamanho) antes de ser gravado.
 */
const PURPOSE_PERMS: Record<UploadPurpose, Permission[] | "any"> = {
  avatar: "any",
  submission: ["learning.access"],
  attachment: ["messages.send", "support.respond"],
  cover: ["courses.create", "courses.manage_own", "courses.manage_any"],
  material: ["courses.manage_own", "courses.manage_any"],
  lessonMedia: ["courses.manage_own", "courses.manage_any"],
  banner: ["banners.manage"],
  logo: ["settings.manage"],
};

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await assertUser();
    await rateLimit("upload", 60, 10 * 60 * 1000, user.id);

    const form = await req.formData();
    const purpose = z.enum(Object.keys(UPLOAD_POLICIES) as [UploadPurpose, ...UploadPurpose[]]).safeParse(form.get("purpose"));
    if (!purpose.success) throw new ValidationError("Finalidade de upload inválida.");
    const required = PURPOSE_PERMS[purpose.data];
    if (required !== "any" && !required.some((p) => user.permissions.has(p))) throw new ForbiddenError();

    const file = form.get("file");
    if (!(file instanceof File)) throw new ValidationError("Selecione um arquivo.");
    const saved = await saveUpload(file, purpose.data, user.id);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return jsonError(error, "upload");
  }
}
