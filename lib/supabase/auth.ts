import { getSupabaseBrowserClient } from "./client";

export async function signUpDentist(input: {
  email: string;
  password: string;
  fullName: string;
}) {
  const supabase = getSupabaseBrowserClient();
  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName, requested_role: "owner" } },
  });
}

export async function signIn(email: string, password: string) {
  return getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return getSupabaseBrowserClient().auth.signOut();
}

