import { LoginView } from "./login-view";
import { resolveSignInDestination } from "./destination";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string; next?: string }>;
}) {
  const { error, code, next } = await searchParams;
  const initialError =
    error === "auth"
      ? "That sign-in link has already been used or has expired. Request a new one below."
      : undefined;

  return (
    <LoginView initialError={initialError} destination={resolveSignInDestination({ code, next })} />
  );
}
