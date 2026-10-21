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
    <main className="mx-auto flex max-w-[1000px] flex-col gap-5 p-8">
      <h1 className="font-vi text-[28px]">SỔ TỪ VỰNG</h1>
      <div className="flex gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={filter === t.id}
            onClick={() => setFilter(t.id)}
            className={`px-btn min-h-11 cursor-pointer border-0 px-4 py-2 text-2xl ${
              filter === t.id ? "bg-blue text-snow" : "bg-steel text-mist"
            }`}
          >
            {t.label} ({q.data?.counts[t.id] ?? 0})
          </button>
        ))}
      </div>
      <div className="px-box flex flex-col bg-steel">
        {q.isLoading && <p className="p-5 text-2xl text-mist">Đang tải…</p>}
        {q.data?.items.length === 0 && (
          <p className="p-5 text-2xl text-mist">
            {filter === "due"
              ? "Chưa có từ nào đến hạn ôn. Chơi thêm vài ván nhé!"
              : filter === "saved"
                ? "Bạn chưa lưu từ nào."
                : "Chơi một ván Word Blaster để bắt đầu học từ."}
          </p>
        )}
        {q.data?.items.map((w) => (
          <div
            key={w.id}
            className="flex items-center gap-4 border-b-2 border-abyss px-5 py-3 text-[26px]"
          >
            <button
              type="button"
              aria-label={`Phát âm ${w.lemma}`}
              onClick={() => speak(w.id, w.lemma)}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center border-0 bg-ink p-0"
            >
              <PixelIcon name="speaker" size={16} color="#f4f4f4" />
            </button>
            <span className="w-40 shrink-0">{w.lemma}</span>
            <span className="w-32 shrink-0 text-mist">{w.ipa}</span>
            <span className="min-w-0 flex-1 truncate">{w.meaningVi}</span>
            <div className="w-24 shrink-0" title={`Hộp ôn tập ${w.box}/5`}>
              <PixelBar value={w.box} max={5} color="#41a6f6" label="Mức nhớ" />
            </div>
            <button
              type="button"
              aria-label={w.saved ? "Bỏ lưu" : "Lưu từ"}
              aria-pressed={w.saved}
              onClick={() => save.mutate({ wordId: w.id, saved: !w.saved })}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center border-0 bg-ink p-0"
            >
              <PixelIcon name="star" size={18} color={w.saved ? "#ffcd75" : "#566c86"} />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
