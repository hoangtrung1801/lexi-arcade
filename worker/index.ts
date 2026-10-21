import { Hono } from "hono";
import { createAuth } from "./auth";
import type { AppEnv } from "./env";
import { loadUser, rateLimit } from "./middleware";
import { audio } from "./routes/audio";
import { content } from "./routes/content";
import { dev } from "./routes/dev";
import { health } from "./routes/health";
import { leaderboard } from "./routes/leaderboard";
import { me } from "./routes/me";
import { quests } from "./routes/quests";
import { sessions } from "./routes/sessions";
import { vocab } from "./routes/vocab";

const app = new Hono<AppEnv>();

app.on(["GET", "POST"], "/api/auth/*", rateLimit("RL_AUTH"), (c) => createAuth(c.env).handler(c.req.raw));

const api = new Hono<AppEnv>()
  .use(loadUser)
  .route("/health", health)
  .route("/dev", dev)
  .route("/me", me)
  .route("/", content)
  .route("/sessions", sessions)
  .route("/vocab", vocab)
  .route("/leaderboard", leaderboard)
  .route("/quests", quests)
  .route("/audio", audio);

app.route("/api", api);
app.all("/api/*", (c) => c.json({ error: "not-found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal" }, 500);
});

export default app;
