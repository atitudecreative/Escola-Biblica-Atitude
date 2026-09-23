import { redirect } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { openDirectConversation } from "@/server/services/messages";
import { AppError } from "@/server/errors";
import { Alert } from "@/components/ui/alert";

/** /messages — painel vazio (desktop). `?to=<userId>` abre ou cria a conversa direta, se a relação for permitida. */
export default async function MessagesPage({ searchParams }: PageProps<"/messages">) {
  const user = await requirePermissionPage("messages.send", "support.respond");
  const { to } = await searchParams;
  let error: string | null = null;
  if (typeof to === "string" && to) {
    let id: string | null = null;
    try {
      id = await openDirectConversation(user, to);
    } catch (e) {
      error = e instanceof AppError ? e.message : "Não foi possível abrir a conversa.";
    }
    if (id) redirect(`/messages/${id}`);
  }
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      {error && (
        <Alert tone="danger" className="mb-6 max-w-md text-left" title="Conversa indisponível">
          {error}
        </Alert>
      )}
      <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted">
        <MessagesSquare className="size-5" aria-hidden />
      </div>
      <h2 className="mt-4 text-h4 text-fg">Selecione uma conversa</h2>
      <p className="mt-1 max-w-sm text-small text-muted">Escolha uma conversa na lista ou comece uma nova com seus professores ou com o suporte.</p>
    </div>
  );
}
