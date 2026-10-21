import { useState } from "react";
import { PixelBar } from "../components/ui/PixelBar";
import { PixelIcon } from "../components/ui/PixelIcon";
import { useSaveWord, useVocab } from "../lib/queries";
import { speak } from "../lib/sfx";

const TABS = [
  { id: "learned", label: "Đã học" },
  { id: "due", label: "Cần ôn lại" },
  { id: "saved", label: "Đã lưu" },
] as const;

export function VocabPage() {
  const [filter, setFilter] = useState<(typeof TABS)[number]["id"]>("learned");
  const q = useVocab(filter);
  const save = useSaveWord();
  return (
    <main className="mx-auto flex max-w-[1040px] flex-col gap-5 p-8">
      <h1 className="t-lg t-bold uppercase">Sổ từ vựng</h1>
      <div className="flex gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={filter === t.id}
            onClick={() => setFilter(t.id)}
            className={`t-md px-3 pt-0.5 pb-1.5 ${
              filter === t.id ? "hb-btn-blue text-[#0c1440]" : "hb-btn-dark text-mist"
            }`}
          >
            {t.label}{" "}
            <span className={filter === t.id ? "text-[#1d3383]" : "text-slate"}>
              {q.data?.counts[t.id] ?? 0}
            </span>
          </button>
        ))}
      </div>
      <div className="hb-panel hb-lift flex flex-col p-2">
        {q.isLoading && <p className="t-md p-4 text-mist">Đang tải…</p>}
        {q.data?.items.length === 0 && (
          <p className="t-md p-4 text-mist">
            {filter === "due"
              ? "Chưa có từ nào đến hạn ôn. Chơi thêm vài ván nhé!"
              : filter === "saved"
                ? "Bạn chưa lưu từ nào."
                : "Chơi một ván Word Blaster để bắt đầu học từ."}
          </p>
        )}
        {q.data?.items.map((w, i) => (
          <div
            key={w.id}
            className={`flex items-center gap-4 px-3 py-2 ${i % 2 ? "" : "bg-[rgb(255_255_255/0.03)]"} border-[#15112b] border-b-2 last:border-b-0`}
          >
            <button
              type="button"
              aria-label={`Phát âm ${w.lemma}`}
              onClick={() => speak(w.id, w.lemma)}
              className="hb-btn-grey group flex h-10 w-10 shrink-0 items-center justify-center pb-0.5"
            >
              <PixelIcon
                name="speaker"
                size={16}
                color="#f6f1ff"
                className="relative group-active:top-0.5"
              />
            </button>
            <span className="font-px t-md w-44 shrink-0">{w.lemma}</span>
            <span className="t-sm w-36 shrink-0 text-slate">{w.ipa}</span>
            <span className="t-md min-w-0 flex-1 truncate text-haze">{w.meaningVi}</span>
            <div className="w-28 shrink-0" title={`Hộp ôn tập ${w.box}/5`}>
              <PixelBar
                value={w.box}
                max={5}
                color="var(--color-cyan)"
                label="Mức nhớ"
                height={8}
              />
            </div>
            <button
              type="button"
              aria-label={w.saved ? "Bỏ lưu" : "Lưu từ"}
              aria-pressed={w.saved}
              onClick={() => save.mutate({ wordId: w.id, saved: !w.saved })}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center transition-transform hover:-translate-y-0.5"
            >
              <PixelIcon name="star" size={22} dim={!w.saved} />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
