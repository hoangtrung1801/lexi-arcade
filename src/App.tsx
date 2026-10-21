import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { DesktopOnly } from "./components/layout/DesktopOnly";
import { RequireAuth } from "./components/RequireAuth";
import { ToastHost } from "./components/ui/Toast";
import { useIsDesktop } from "./lib/useDesktop";
import { HubPage } from "./pages/HubPage";
import { AboutPage, NotFoundPage, PrivacyPage } from "./pages/InfoPages";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { LoginPage } from "./pages/LoginPage";
import { MapPage } from "./pages/MapPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ResultPage } from "./pages/ResultPage";
import { VocabPage } from "./pages/VocabPage";

// Phaser is heavy: only load it when someone actually opens a round.
const PlayPage = lazy(() => import("./pages/PlayPage").then((m) => ({ default: m.PlayPage })));

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

export function App() {
  const desktop = useIsDesktop();
  if (!desktop) return <DesktopOnly />;
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/games/word-blaster/play/:unitId"
            element={
              <Suspense fallback={<p className="p-8 text-3xl text-mist">Đang tải game…</p>}>
                <PlayPage />
              </Suspense>
            }
          />
          <Route element={<AppShell />}>
            <Route index element={<HubPage />} />
            <Route path="games/word-blaster" element={<MapPage />} />
            <Route path="games/word-blaster/result/:sessionId" element={<ResultPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route element={<RequireAuth />}>
              <Route path="vocab" element={<VocabPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <ToastHost />
    </QueryClientProvider>
  );
}
