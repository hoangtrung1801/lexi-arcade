import type { AnyEvent } from "@shared/rounds";
import type { GameConfig, GameWord, Ghost, RoundResult, Sentence } from "@shared/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SkyScene } from "../components/layout/SkyScene";
import { Modal } from "../components/ui/Modal";
import { PixelButton } from "../components/ui/PixelButton";
import { PixelIcon } from "../components/ui/PixelIcon";
import { toast } from "../components/ui/Toast";
import { Round as RaceRound } from "../games/ghost-race/Round";
import { gameById } from "../games/registry";
import { Round as TrainRound } from "../games/sentence-express/Round";
import { ApiError } from "../lib/api";
import {
  finishSession,
  startSession,
  useMe,
  useUnitSentences,
  useUnits,
  useUnitWords,
} from "../lib/queries";
import { useLastRound } from "../store/lastRound";
import { useSettings } from "../store/settings";

// Phaser is heavy: only Word Blaster loads it.
const BlasterRound = lazy(() =>
  import("../games/word-blaster/Round").then((m) => ({ default: m.Round })),
);

type Config = GameConfig & { sessionId: string | null; sentences: Sentence[]; ghosts: Ghost[] };

export function PlayPage() {
  const params = useParams();
  const game = gameById(params.gameId);
  if (!game) return <Navigate to="/" replace />;
  return <Play key={game.id} gameId={game.id} />;
}

function Play({ gameId }: { gameId: NonNullable<ReturnType<typeof gameById>>["id"] }) {
  const unitId = Number(useParams().unitId);
  const slug = useSearchParams()[0].get("set") ?? "a1";
  const nav = useNavigate();
  const attempt = useLocation().key;
  const qc = useQueryClient();
  const meQ = useMe();
  const user = meQ.data?.user ?? null;
  // frozen at mount: changing the setting must not restart a round in progress
  const [difficulty] = useState(() => useSettings.getState().difficulty);
  const setRound = useLastRound((s) => s.setRound);
  const unitsQ = useUnits(slug, gameId);
  const unit = unitsQ.data?.units.find((u) => u.id === unitId);
  const base = `/games/${gameId}`;

  const exit = useCallback(() => nav(base), [nav, base]);

  // Logged-in players start a server session (server picks words + seed); guests play locally.
  const sessionQ = useQuery({
    queryKey: ["session-start", gameId, unitId, attempt, difficulty],
    queryFn: () => startSession({ gameId, unitId, difficulty }),
    enabled: meQ.isSuccess && !!user,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
  });
  const guest = meQ.isSuccess && !user;
  const sentenceGame = gameId === "sentence-express";
  const guestWords = useUnitWords(guest && !sentenceGame ? unitId : null, gameId);
  const guestSentences = useUnitSentences(guest && sentenceGame ? unitId : null);

  const config: Config | null = useMemo(() => {
    if (sessionQ.data) {
      const s = sessionQ.data;
      return {
        sessionId: s.sessionId,
        unitId,
        seed: s.seed,
        difficulty: s.difficulty,
        words: s.words,
        sentences: s.sentences,
        ghosts: s.ghosts,
      };
    }
    const guestData = sentenceGame
      ? guestSentences.data
      : guestWords.data && { words: guestWords.data.words, sentences: [] as Sentence[] };
    if (guestData) {
      return {
        sessionId: null,
        unitId,
        seed: Math.floor(Math.random() * 2 ** 32),
        difficulty,
        words: guestData.words,
        sentences: guestData.sentences,
        ghosts: [],
      };
    }
    return null;
    // the config must stay fixed for the whole round
  }, [sessionQ.data, guestWords.data, guestSentences.data, sentenceGame, unitId, difficulty]);

  const [saveError, setSaveError] = useState<{
    events: AnyEvent[];
    result: RoundResult;
    words: GameWord[];
  } | null>(null);

  const finish = useCallback(
    async (result: RoundResult, events: AnyEvent[], words: GameWord[]) => {
      if (!config) return;
      const round = {
        gameId,
        unitId,
        unitIdx: unit?.idx ?? 0,
        unitTitle: unit?.titleVi ?? "",
        setSlug: slug,
        difficulty: config.difficulty,
        words,
      };
      if (!config.sessionId) {
        setRound({ ...round, result, rewards: null, saved: false });
        nav(`${base}/result/guest`, { replace: true });
        return;
      }
      try {
        const res = await finishSession(config.sessionId, { events });
        setRound({ ...round, result: res.result, rewards: res.rewards, saved: true });
        for (const key of ["me", "units", "vocab", "quests", "leaderboard"]) {
          qc.invalidateQueries({ queryKey: [key] });
        }
        nav(`${base}/result/${config.sessionId}`, { replace: true });
      } catch (e) {
        if (e instanceof ApiError && e.status === 422) {
          toast("Ván chơi không hợp lệ nên không được lưu.", "bad");
          setRound({ ...round, result, rewards: null, saved: false });
          nav(`${base}/result/${config.sessionId}`, { replace: true });
        } else {
          setSaveError({ events, result, words });
        }
      }
    },
    [config, nav, qc, setRound, slug, unit, unitId, gameId, base],
  );

  const loadError = sessionQ.error ?? guestWords.error ?? guestSentences.error;
  if (loadError) {
    const locked =
      loadError instanceof ApiError && (loadError.status === 403 || loadError.status === 401);
    return (
      <Centered>
        <p className="t-md">
          {locked
            ? "Mốc này chưa mở. Hãy hoàn thành mốc trước hoặc đăng nhập."
            : "Không tải được ván chơi."}
        </p>
        <PixelButton tone="gold" onClick={exit}>
          VỀ BẢN ĐỒ
        </PixelButton>
      </Centered>
    );
  }
  if (!config)
    return (
      <Centered>
        <PixelIcon name="ship" size={60} className="anim-bob" />
        <span className="t-md text-mist">Đang chuẩn bị ván chơi…</span>
      </Centered>
    );

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-void">
      {gameId === "ghost-race" ? (
        <RaceRound
          key={config.sessionId ?? "guest"}
          config={config}
          unitIdx={unit?.idx ?? 0}
          unitTitle={unit?.titleVi ?? ""}
          onFinish={finish}
          onExit={exit}
        />
      ) : gameId === "sentence-express" ? (
        <TrainRound
          key={config.sessionId ?? "guest"}
          config={config}
          unitIdx={unit?.idx ?? 0}
          unitTitle={unit?.titleVi ?? ""}
          onFinish={finish}
          onExit={exit}
        />
      ) : (
        <Suspense fallback={<span className="t-md text-mist">Đang tải game…</span>}>
          <BlasterRound
            key={config.sessionId ?? "guest"}
            config={config}
            unitIdx={unit?.idx ?? 0}
            unitCount={unitsQ.data?.units.length ?? 0}
            setName={unitsQ.data?.set.name ?? ""}
            onFinish={finish}
            onExit={exit}
          />
        </Suspense>
      )}
      <Modal
        open={!!saveError}
        title="CHƯA LƯU ĐƯỢC KẾT QUẢ"
        actions={
          <>
            <PixelButton size="sm" onClick={exit}>
              BỎ QUA
            </PixelButton>
            <PixelButton
              tone="gold"
              size="sm"
              onClick={() => {
                const e = saveError;
                setSaveError(null);
                if (e) void finish(e.result, e.events, e.words);
              }}
            >
              THỬ LẠI
            </PixelButton>
          </>
        }
      >
        Kiểm tra kết nối mạng rồi thử lại nhé.
      </Modal>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center gap-6 text-center">
      <SkyScene />
      <div className="relative flex flex-col items-center gap-5">{children}</div>
    </div>
  );
}
