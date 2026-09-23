/**
 * Contas de demonstração — exibidas somente quando DEMO_MODE=true.
 * As senhas são as do seed (prisma/seed.ts); nunca ative em produção real.
 */
const accounts = [
  { role: "Aluno", email: "aluno@demo.eba" },
  { role: "Professor", email: "professor@demo.eba" },
  { role: "Gestor", email: "gestor@demo.eba" },
  { role: "Admin", email: "admin@demo.eba" },
];

export function DemoAccounts() {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-border-strong p-4">
      <p className="text-overline text-subtle">Ambiente de demonstração</p>
      <ul className="mt-2 space-y-1 text-small">
        {accounts.map((a) => (
          <li key={a.email} className="flex justify-between gap-3">
            <span className="text-muted">{a.role}</span>
            <code className="text-fg">{a.email}</code>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-caption text-subtle">
        Senha para todas: <code className="text-fg">Demo@2026</code>
      </p>
    </div>
  );
}
