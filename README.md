# Lexi Arcade

Hub game pixel để học tiếng Anh. Game đầu tiên: **Word Blaster** — gõ đúng từ tiếng Anh đang rơi để bắn hạ chúng.

React + Vite + TypeScript · Phaser · một Cloudflare Worker (Hono) · D1 · KV · R2 · Better Auth (Google).
Tài liệu kiến trúc và plan: xem doc "Lexi Arcade — Kiến trúc & Plan MVP (Web)".

## Chạy local

```bash
pnpm install
cp .dev.vars.example .dev.vars     # DEV_LOGIN=true bật đăng nhập thử, không cần Google
pnpm db:migrate:local              # tạo schema trong D1 local
pnpm content:seed                  # nạp bộ từ A1/A2 từ content/sets/*.csv
pnpm dev                           # http://localhost:5173 (React + Worker + D1/KV/R2 giả lập)
```

Khách chơi được 3 mốc đầu mỗi bộ. Để đăng nhập thử: `/login` → "Đăng nhập thử (chỉ dev)".

## Kiểm tra

```bash
pnpm lint && pnpm typecheck && pnpm content:validate
pnpm test                          # unit test (shared/, engine) + API test nếu server đang chạy
API_BASE=http://localhost:5173 pnpm test   # ép chạy API test với server đang mở
pnpm test:e2e                      # Playwright: chơi trọn một mốc bằng bàn phím thật
```

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `shared/` | Luật chấm điểm, SRS, kiểm tra hợp lệ — frontend và Worker cùng import |
| `worker/` | API Hono: auth, nội dung, session/finish (server tính lại điểm), vocab, xếp hạng, nhiệm vụ, audio |
| `db/`, `migrations/` | Schema Drizzle + migration D1 |
| `src/games/word-blaster/` | `logic/engine.ts` (thuần TS, có test), `phaser/` (chỉ vẽ), `Round.tsx` (HUD, ô gõ, IME) |
| `src/pages/`, `src/components/` | Màn hình và UI kit pixel |
| `content/` | `meanings-vi.txt` (nghĩa tiếng Việt, chưa duyệt), `sets/*.csv` (dữ liệu từ), `ids.json` (id từ ổn định) |
| `scripts/content/` | `fetch` → `build` → `validate` → `seed` → `tts` |

## Pipeline nội dung

```bash
pnpm tsx scripts/content/fetch.ts      # tải danh sách Oxford 3000 + Wiktionary (IPA) vào content/raw
pnpm content:build --force             # ghi lại content/sets/*.csv (cảnh báo: ghi đè chỉnh sửa tay)
pnpm content:validate
pnpm content:seed [--remote] [--env staging]
CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… pnpm content:tts [--remote]   # tạo audio bằng Workers AI → R2
```

Nghĩa tiếng Việt do máy dịch, mọi dòng đang `reviewed=false`. Duyệt trực tiếp trong `content/sets/*.csv` rồi đặt `reviewed=true`, chạy lại `content:seed`.
**Trước khi public**: kiểm tra điều khoản danh sách Oxford (OUP), xem mục Rủi ro trong doc plan.

## Triển khai Cloudflare

1. Tạo D1 (`lexi-db`, `lexi-db-staging`), KV `CACHE`, R2 `lexi-audio` và thay các id placeholder trong `wrangler.jsonc`.
2. Tạo Google OAuth client; redirect URI: `{APP_URL}/api/auth/callback/google`.
3. `wrangler secret put BETTER_AUTH_SECRET|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET`, đặt `APP_URL` đúng domain.
4. GitHub Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Workflow: `.github/workflows/ci.yml`, `deploy.yml`.
5. **Không** đặt `DEV_LOGIN` ở staging/production.
