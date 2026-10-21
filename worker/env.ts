export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  AUDIO: R2Bucket;
  ASSETS: Fetcher;
  RL_AUTH?: RateLimit;
  RL_SESSIONS?: RateLimit;
  APP_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Local development only. Never set this in staging/production. */
  DEV_LOGIN?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { user: AuthUser | null };
};
