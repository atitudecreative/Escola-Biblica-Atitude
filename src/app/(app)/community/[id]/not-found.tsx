import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-10">
      <EmptyState
        icon={MessagesSquare}
        title="Discussão não encontrada"
        description="Ela pode ter sido removida pela moderação ou pelo autor."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/community">Voltar para a comunidade</Link>
          </Button>
        }
      />
    </div>
  );
}
