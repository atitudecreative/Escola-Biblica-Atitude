import { describe, expect, it } from "vitest";
import { cn, initials, safeNextPath, slugify } from "../utils";
import { formatBytes, formatClock, formatDuration } from "../format";
import { passwordStrength, registerSchema, resetSchema } from "../validation/auth";

describe("utils", () => {
  it("slugify remove acentos e símbolos", () => {
    expect(slugify("Hermenêutica: como interpretar a Bíblia!")).toBe("hermeneutica-como-interpretar-a-biblia");
  });
  it("initials", () => {
    expect(initials("Ana Beatriz Lima")).toBe("AL");
    expect(initials("Rafael")).toBe("R");
  });
  it("safeNextPath bloqueia open redirect", () => {
    expect(safeNextPath("/courses")).toBe("/courses");
    expect(safeNextPath("//evil.com")).toBe("/dashboard");
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.com")).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
  });
  it("cn preserva escala tipográfica customizada junto com cor", () => {
    expect(cn("text-small text-primary-fg")).toContain("text-primary-fg");
    expect(cn("text-small text-primary-fg")).toContain("text-small");
  });
});

describe("format", () => {
  it("duração", () => {
    expect(formatDuration(5400)).toBe("1h 30min");
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(150)).toBe("2min");
  });
  it("relógio", () => {
    expect(formatClock(95)).toBe("01:35");
    expect(formatClock(3723)).toBe("1:02:03");
  });
  it("bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1,5 KB");
  });
});

describe("validação de autenticação", () => {
  it("senha precisa de letras e números", () => {
    const base = { name: "Ana", email: "ana@x.com", acceptTerms: true as const };
    expect(registerSchema.safeParse({ ...base, password: "abcdefgh" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "abcdefg1" }).success).toBe(true);
  });
  it("e-mail é normalizado", () => {
    const r = registerSchema.parse({ name: "Ana", email: "  ANA@X.COM ", password: "abcdefg1", acceptTerms: true });
    expect(r.email).toBe("ana@x.com");
  });
  it("confirmação de senha", () => {
    expect(resetSchema.safeParse({ token: "x".repeat(30), password: "abcdefg1", confirm: "abcdefg2" }).success).toBe(false);
  });
  it("força da senha", () => {
    expect(passwordStrength("abc")).toBe(0);
    expect(passwordStrength("Abcdefgh12!@xyz")).toBe(4);
  });
});
