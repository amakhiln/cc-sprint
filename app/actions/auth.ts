"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, SESSION_SECONDS, tokenForPassword } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const attempt = formData.get("password");
  const token = typeof attempt === "string" ? await tokenForPassword(attempt) : null;
  if (!token) redirect("/login?error=1");

  (await cookies()).set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  redirect("/");
}

// ponytail: tokens are stateless, so this only clears this browser's copy; a
// copied token stays valid until its 9h expiry. Rotate the password
// (scripts/set-password.mjs) to kill every token at once.
export async function logoutAction() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}
