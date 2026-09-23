import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, hasPermission } from "../permissions";

describe("RBAC padrão", () => {
  it("admin tem todas as permissões", () => {
    expect(new Set(DEFAULT_ROLE_PERMISSIONS.admin)).toEqual(new Set(ALL_PERMISSIONS));
  });
  it("aluno não administra nada", () => {
    const s = DEFAULT_ROLE_PERMISSIONS.student;
    for (const p of ["users.manage", "settings.manage", "courses.manage_any", "reports.view"] as const) expect(s).not.toContain(p);
  });
  it("professor gerencia apenas os próprios cursos", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.teacher).toContain("courses.manage_own");
    expect(DEFAULT_ROLE_PERMISSIONS.teacher).not.toContain("courses.manage_any");
  });
  it("gestor vê indicadores mas não altera configurações", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.manager).toContain("analytics.view");
    expect(DEFAULT_ROLE_PERMISSIONS.manager).not.toContain("settings.manage");
  });
  it("hasPermission aceita array e Set", () => {
    expect(hasPermission(["learning.access"], "learning.access")).toBe(true);
    expect(hasPermission(new Set(["learning.access"]), "users.manage")).toBe(false);
  });
});
