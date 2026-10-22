/** Topic keys used in content/meanings-vi.txt, in the order units are presented (concrete & easy first). */
export const TOPICS = [
  { key: "fam", title: "Gia đình & con người" },
  { key: "body", title: "Cơ thể & sức khỏe" },
  { key: "food", title: "Đồ ăn & thức uống" },
  { key: "home", title: "Nhà cửa & đồ dùng" },
  { key: "cloth", title: "Quần áo & mua sắm" },
  { key: "nat", title: "Thiên nhiên & động vật" },
  { key: "wthr", title: "Thời tiết & màu sắc" },
  { key: "time", title: "Thời gian & số đếm" },
  { key: "place", title: "Địa điểm & thành phố" },
  { key: "trav", title: "Du lịch & giao thông" },
  { key: "work", title: "Trường học & công việc" },
  { key: "fun", title: "Giải trí & thể thao" },
  { key: "feel", title: "Cảm xúc" },
  { key: "verb", title: "Động từ thường gặp" },
  { key: "adj", title: "Tính từ thường gặp" },
  { key: "func", title: "Từ nối & từ chức năng" },
  { key: "misc", title: "Từ vựng chung" },
] as const;

export const TOPIC_TITLE: Record<string, string> = Object.fromEntries(
  TOPICS.map((t) => [t.key, t.title]),
);

export const SETS = [
  { id: 1, slug: "a1", name: "Bộ A1", cefr: "a1", sortOrder: 1 },
  { id: 2, slug: "a2", name: "Bộ A2", cefr: "a2", sortOrder: 2 },
  { id: 3, slug: "b1", name: "Bộ B1", cefr: "b1", sortOrder: 3 },
  { id: 4, slug: "b2", name: "Bộ B2", cefr: "b2", sortOrder: 4 },
] as const;
