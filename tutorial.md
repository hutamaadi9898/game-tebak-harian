# Deployment Tutorial (Dev & Production)

## Prasyarat
- Node 20+ dan `pnpm` terpasang.
- Akun Cloudflare dengan akses Pages, D1, dan (opsional) R2/KV.
- Wrangler v4.50+ (`pnpm dlx wrangler --version`).

## 1) Jalankan Secara Lokal (dev)
1. **Install dependensi**: `pnpm install`
2. **Siapkan environment lokal**
   - Salin sekret dev (boleh dummy):
     - `GAME_SECRET=dev-secret-change-in-prod`
     - `SUBSCRIPTION_SALT=dev-subscription-salt`
     - `SESSION_PASSWORD=dev-session-password-change` (untuk driver sesi berbasis cookie; tidak pakai KV)
     - (Opsional) `IMAGE_BUCKET` binding hanya tersedia di cloud; di lokal tidak wajib.
   - Simpan di `.env` (hanya untuk lokal; jangan commit).
3. **Jalankan dev server**: `pnpm dev`
   - Astro akan jalan di `http://localhost:4321` dengan fungsi edge diproksi.
4. **Regenerasi data (opsional)**: `pnpm tsx scripts/fetch-wikidata.ts`
5. **Tes otomatis**: `pnpm test`

## 2) Siapkan Resource Cloudflare (sekali saja)
1. **Buat D1 untuk streak/rate-limit/subscription**
   - `wrangler d1 create guess-game-streaks`
   - Catat `database_id`, masukkan ke `wrangler.jsonc` (ganti placeholder `0000...`).
2. **(Opsional) Buat R2/KV** jika nanti dibutuhkan; saat ini tidak wajib.
   - Untuk gambar cepat: `wrangler r2 bucket create guess-game-images` lalu pastikan binding `IMAGE_BUCKET` di `wrangler.jsonc`.
3. **Set secrets di Cloudflare** (production):
   - `wrangler secret put GAME_SECRET`
   - `wrangler secret put SUBSCRIPTION_SALT`
   - (Opsional) `wrangler secret put PUBLIC_CF_BEACON_TOKEN` untuk Web Analytics.

## 3) Preview / Staging di Cloudflare Pages
1. **Build**: `pnpm build`
2. **Preview dengan wrangler**: `pnpm preview`
   - Memastikan `_worker.js` terbangun dan fungsi berjalan.

## 4) Deploy ke Production (Pages Functions)
1. **Pastikan `wrangler.jsonc` sudah diisi**
   - `main` menunjuk ke `./dist/_worker.js/index.js` (default build Astro).
   - `d1_databases[0].database_id` berisi ID aktual.
   - Vars minimal: `GAME_SECRET`, `SUBSCRIPTION_SALT` (non-dev nilai rahasia).
   - Tambah `SESSION_PASSWORD` (nilai panjang & acak) untuk driver sesi cookie.
2. **Build produksi**: `pnpm build`
3. **Deploy**: `pnpm deploy`
   - Wrangler akan meng-upload bundle `_worker.js` + aset statis.
4. **Migrasi skema D1** (opsional, karena skema dibuat otomatis on-demand):
   - Tidak perlu migrasi manual; tabel dibuat otomatis pada request pertama melalui `ensureSchema`. Jika ingin eager: 
   - `wrangler d1 execute guess-game-streaks --file scripts/migrations/streaks.sql` (buat file jika ingin eksplisit).

## 5) Konfigurasi Pasca-Deploy
- **Domain kustom**: atur di Cloudflare Pages dashboard.
- **Cache**: sudah ada header cache di `/api/today`; tambah Page Rules jika perlu.
- **Analytics**: set `PUBLIC_CF_BEACON_TOKEN` untuk mengaktifkan Cloudflare Web Analytics.
- **Gambar cepat**: semua gambar kini lewat proxy `/api/image/:id` dengan Cache API (1h browser/7d edge). Tidak perlu R2, tapi jika ingin preload ke R2, cukup ganti `person.image` ke URL R2 pada pipeline dan biarkan proxy mem-cache.

## 6) Rutinitas Operasional
- **Regenerasi data** mingguan/bulanan dengan `pnpm tsx scripts/fetch-wikidata.ts` lalu deploy.
- **Pantau rate-limit** via D1 tabel `rate_limits` jika perlu tuning.
- **Backup ringan**: ekspor tabel D1 `streaks`/`subscriptions` via `wrangler d1 export` sesuai kebutuhan.

## 7) Troubleshooting Cepat
- Build gagal terkait DO/D1 binding → pastikan `database_id` terisi dan secrets ada.
- Signature error di `/api/score` → periksa `GAME_SECRET` konsisten antara server dan klien.
- Fun-fact kosong → run ulang pipeline atau periksa SPARQL endpoint rate limit.

Selalu commit secara atomik dan perbarui `progress.md` setelah setiap perubahan bermakna.
