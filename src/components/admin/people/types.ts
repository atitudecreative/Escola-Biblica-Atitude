import type { RoleKey } from "@/lib/permissions";

/** Dados mínimos de uma conta que as ações client precisam (nunca inclui hash de senha). */
export type EditableUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  headline: string | null;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  roles: RoleKey[];
};
