import { LoginView } from "./login-view";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError =
    error === "auth"
      ? "That sign-in link has already been used or has expired. Request a new one below."
      : undefined;

  return <LoginView initialError={initialError} />;
}
