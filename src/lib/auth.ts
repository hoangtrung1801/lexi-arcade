import { createAuthClient } from "better-auth/react";
import { api } from "./api";

const client = createAuthClient({ baseURL: window.location.origin });

export function signInWithGoogle(returnTo = "/") {
  return client.signIn.social({ provider: "google", callbackURL: returnTo });
}

export async function signOut() {
  await Promise.allSettled([client.signOut(), api("/dev/logout", { method: "POST" })]);
}

/** Only works when the Worker has DEV_LOGIN=true (local development). */
export function devLogin(name: string) {
  return api<{ ok: true }>("/dev/login", { method: "POST", body: { name } });
}
