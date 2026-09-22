"use server";
import { redirect } from "next/navigation";
import { parseInput, runAction } from "@/server/action";
import * as auth from "@/server/services/auth";
import { destroyCurrentSession } from "@/server/auth/session";
import { assertUser } from "@/server/auth/guards";
import { forgotSchema, loginSchema, registerSchema, resetSchema } from "@/lib/validation/auth";
import { safeNextPath } from "@/lib/utils";

export async function loginAction(input: unknown) {
  const result = await runAction("login", async () => {
    const data = parseInput(loginSchema, input);
    await auth.login(data);
    return safeNextPath(data.next);
  });
  if (result.ok) redirect(result.data);
  return result;
}

export async function registerAction(input: unknown) {
  const result = await runAction("register", async () => {
    const data = parseInput(registerSchema, input);
    return auth.register(data).then((r) => r.needsVerification);
  });
  if (result.ok) redirect(result.data ? "/verify-email?sent=1" : "/dashboard?welcome=1");
  return result;
}

export async function forgotPasswordAction(input: unknown) {
  return runAction("forgot_password", async () => {
    const data = parseInput(forgotSchema, input);
    await auth.requestPasswordReset(data.email);
  });
}

export async function resetPasswordAction(input: unknown) {
  const result = await runAction("reset_password", async () => {
    const data = parseInput(resetSchema, input);
    await auth.resetPassword(data.token, data.password);
  });
  if (result.ok) redirect("/login?reset=1");
  return result;
}

export async function resendVerificationAction() {
  return runAction("resend_verification", async () => {
    const user = await assertUser();
    await auth.resendVerification(user.id);
  }, "Enviamos um novo link de confirmação.");
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/login");
}
