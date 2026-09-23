import Link from "next/link";
import type { Metadata } from "next";
import { FileBarChart } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { getKpis, getSeries, recentActivity, topCourses, topTeachers } from "@/server/services/analytics";
import { parsePeriod } from "@/lib/analytics-period";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "@/components/analytics/period-filter";
import { AnalyticsDashboard, comparisonLabel } from "@/components/analytics/dashboard";

export const metadata: Metadata = { title: "Indicadores · Gestão" };

export default async function ManagerPage(props: PageProps<"/manager">) {
  const user = await requirePermissionPage("analytics.view");
  const period = parsePeriod(await props.searchParams);
  const [kpis, series, courses, teachers, activity] = await Promise.all([
    getKpis(period),
    getSeries(period),
    topCourses(period),
    topTeachers(period),
    recentActivity(10),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Indicadores"
        description="Engajamento, matrículas e resultados da Escola. Os números respeitam o período escolhido e comparam com o período imediatamente anterior."
        actions={
          user.permissions.has("reports.view") && (
            <Button variant="outline" asChild>
              <Link href="/manager/reports">
                <FileBarChart /> Relatórios
              </Link>
            </Button>
          )
        }
      />
      <PeriodFilter className="mb-6" value={period.key} from={period.fromISO} to={period.toISO} comparison={comparisonLabel(period)} />
      <AnalyticsDashboard
        kpis={kpis}
        series={series}
        courses={courses}
        teachers={teachers}
        activity={activity}
        canOpenPeople={user.permissions.has("students.view_all") || user.permissions.has("users.view")}
      />
    </>
  );
}
