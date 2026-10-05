import { loginAction } from "@/app/actions/auth";
import { SubmitButton } from "./submit-button";
import { PasswordInput } from "./password-input";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <form action={loginAction} className="flex w-full max-w-sm flex-col gap-3">
        <h1 className="text-xl font-semibold text-foreground">Sprint &amp; Velocity Planner</h1>
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <PasswordInput invalid={!!error} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            Incorrect password.
          </p>
        )}
        <SubmitButton />
      </form>
    </main>
  );
}
