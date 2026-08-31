import { LoginView } from "./login-view";
import { resolveSignInDestination } from "./destination";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string; next?: string }>;
}) {
  const { error, code, next } = await searchParams;
  // `link` means the token was rejected when actually redeemed; `auth` means
  // the link arrived without one. Both point at the same recovery — request a
  // fresh email and type the code, which no scanner and no other browser can
  // interfere with.
  const initialError =
    error === "link" || error === "auth"
      ? "That sign-in link didn't work. Send yourself a new email below and type the code from it — that always works, wherever the email opens."
      : undefined;

  return (
    <LoginView initialError={initialError} destination={resolveSignInDestination({ code, next })} />
  );
}
