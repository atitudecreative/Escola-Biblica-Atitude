"use client";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { resendVerificationAction } from "@/app/(auth)/actions";

export function ResendVerificationButton({ size = "md" }: { size?: "sm" | "md" }) {
  const { run, pending } = useAction(resendVerificationAction, { errorToast: true });
  return (
    <Button variant="outline" size={size} loading={pending} onClick={() => run(undefined as never)}>
      Reenviar link de confirmação
    </Button>
  );
}
