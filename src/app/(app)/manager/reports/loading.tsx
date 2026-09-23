import { TableSkeleton } from "@/components/analytics/skeletons";

export default function Loading() {
  return <TableSkeleton label="Carregando relatório" rows={10} />;
}
