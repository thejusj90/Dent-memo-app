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

export async function signInWithGoogle() {
  return getSupabaseBrowserClient().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.href.split("#")[0] },
  });
}

export async function signOut() {
  return getSupabaseBrowserClient().auth.signOut();
}

export async function getSignedInUser() {
  const { data, error } = await getSupabaseBrowserClient().auth.getUser();
  if (error) throw error;
  return data.user;
}
