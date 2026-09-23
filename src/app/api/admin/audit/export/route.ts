import { assertPermission } from "@/server/auth/guards";
import { jsonError } from "@/server/http";
import { audit } from "@/server/audit";
import { exportAuditLogs } from "@/server/services/admin-logs";
import { auditActionLabel } from "@/components/admin-config/audit-labels";

/** GET /api/admin/audit/export?action=&actor=&from=&to=&q= → CSV (UTF-8 com BOM, separador ;). Permissão: audit.view. */
function cell(v: unknown) {
  let s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  // Evita injeção de fórmula ao abrir no Excel/Sheets.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  try {
    const user = await assertPermission("audit.view");
    const sp = new URL(req.url).searchParams;
    const get = (k: string) => sp.get(k)?.slice(0, 200) || undefined;
    const rows = await exportAuditLogs({ action: get("action"), actor: get("actor"), from: get("from"), to: get("to"), q: get("q") });
    const header = ["data_hora_utc", "acao", "acao_legivel", "ator", "email_ator", "entidade", "entidade_id", "ip", "detalhes"];
    const lines = rows.map((r) =>
      [r.createdAt.toISOString(), r.action, auditActionLabel(r.action), r.actor?.name ?? "Sistema", r.actor?.email ?? "", r.entityType ?? "", r.entityId ?? "", r.ip ?? "", r.metadata]
        .map(cell)
        .join(";"),
    );
    await audit("audit.exported", { actorId: user.id, entityType: "audit", metadata: { rows: rows.length } });
    const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="auditoria-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error, "audit_export");
  }
}
