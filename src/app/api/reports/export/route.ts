import type { NextRequest } from "next/server";
import { assertPermission } from "@/server/auth/guards";
import { audit } from "@/server/audit";
import { jsonError } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { NotFoundError } from "@/server/errors";
import { exportReport, getReportDef } from "@/server/services/reports";
import { parsePeriod } from "@/lib/analytics-period";

/**
 * GET /api/reports/export?type=...&period=&from=&to=&course=&status=&q=&ids=
 * CSV com BOM UTF-8 e ";" como separador (abre corretamente no Excel pt-BR).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await assertPermission("reports.export");
    await rateLimit("reports:export", 30, 10 * 60 * 1000, user.id);
    const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
    const def = getReportDef(sp.type);
    if (!def) throw new NotFoundError("Relatório não encontrado.");
    const period = parsePeriod(sp, { fallback: def.defaultPeriod, allowAll: true });
    const clip = (v?: string) => (v && v.length <= 200 ? v : undefined);
    const ids = sp.ids ? sp.ids.split(",").filter((x) => /^[a-z0-9]{10,40}$/i.test(x)).slice(0, 500) : undefined;
    const filters = {
      period,
      courseId: def.course ? clip(sp.course) : undefined,
      status: def.statusOptions?.some((o) => o.value === sp.status) ? clip(sp.status) : undefined,
      q: clip(sp.q),
      ids,
    };
    const { csv, count } = await exportReport(def, filters);
    await audit("report.exported", {
      actorId: user.id,
      entityType: "report",
      entityId: def.key,
      metadata: { rows: count, period: period.key, from: period.fromISO, to: period.toISO, course: filters.courseId ?? null, status: filters.status ?? null, q: filters.q ?? null, ids: ids?.length ?? null },
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `relatorio-${def.key}-${stamp}.csv`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error, "reports.export");
  }
}
