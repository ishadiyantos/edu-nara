# Edu Nara — Fase 1

Fondasi kelas nyata: login admin, aktivitas kosong, sesi draft/open/closed/ended,
join anonim, ruang tunggu live SSE. UI Indonesia, responsif, form server tetap
berfungsi tanpa JavaScript (SSE membutuhkan JavaScript).

**Belum tersedia:** editor/submission Multiple Choice, Word Cloud, Board, Crossword,
QR/scanner, upload, hasil, reset/CSV. `/mock/*` dan `/design` adalah demo Fase 0,
bukan data kelas nyata. Jangan gunakan demo sebagai bukti backend fitur tersebut.

## Jalankan lokal

Node >=22.13, pnpm **12.6.0**, compiler C++/make/Python untuk `better-sqlite3`.

```sh
corepack enable
corepack prepare pnpm@12.6.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
chmod 600 .env
# Edit .env secara privat: ADMIN_EMAIL, ADMIN_PASSWORD (16–256 karakter),
# ORIGIN=http://localhost:5173 dan COOKIE_SECURE=false untuk HTTP lokal.
node --env-file=.env --import tsx scripts/start.ts --initialize-only
pnpm dev --host 127.0.0.1
```

DB default `~/.local/share/edu-nara/edu-nara.db`. `DATABASE_PATH` bisa mengganti
lokasinya. **SQLite WAL wajib disk lokal, jangan NFS/SMB** (source boleh di NFS).
Tes selalu memakai `:memory:` atau direktori sementara OS, tidak memakai DB kelas.
Seed tidak memiliki kredensial default dan tidak mengganti password akun lama.
Tidak ada registrasi publik. `pnpm db:migrate` dan `pnpm db:seed` tersedia;
untuk CLI scripts, pass env secara eksplisit (`node --env-file=.env --import tsx ...`).

```sh
pnpm check
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

Build selesai dahulu, baru E2E; jangan build bersamaan dengan Playwright.
E2E menjalankan production build dengan DB temporary dan akun **test-only**,
satu worker, viewport 360/768/1440. Untuk standalone production:
`node --env-file=.env --import tsx scripts/start.ts`.

## Alur

1. Login `/admin/login`; buat aktivitas kosong, pilih jenis untuk fase selanjutnya.
2. Luncurkan sesi; kode enam karakter, status awal draft. Klik **Buka sesi**.
3. Bagikan tautan `/join?code=...` atau kode; peserta mengisi nama 2–24 karakter.
4. Admin dan peserta mendapat snapshot serta perubahan status/jumlah melalui SSE.
5. **Tutup sesi** menolak peserta baru (rejoin lama tetap bisa); bisa buka kembali.
   **Akhiri sesi** permanen. Cookie hilang berarti identitas baru, bukan pulih lewat nama.

## Kontrak keamanan / batas satu instance

- Drizzle + SQLite WAL, foreign keys ON, migrasi tersimpan di `drizzle/`.
- Scrypt salt acak, opaque admin token SHA-256 di DB, expiry 8 jam, rotasi setiap
  login, logout revokasi. Cookie peserta per sesi `edu_p_<id>`, hash di DB, expiry 24 jam.
- HttpOnly, SameSite=Lax; Secure default. HTTPS selalu Secure. HTTP LAN hanya
  lewat `COOKIE_SECURE=false`, independen dari NODE_ENV; HTTP tidak melindungi password
  dari penyadapan jaringan. Pakai HTTPS untuk publik.
- Semua mutasi termasuk JSON mensyaratkan Origin persis sama. Set `ORIGIN` URL
  eksternal benar; jangan percaya forwarded headers dari klien sembarang.
- Batas per socket IP / menit: login 10, join 60, aksi dan SSE 120; SSE tambahan
  per identitas 30. 429 + Retry-After. Map maksimum 10.000 key, fail closed saat penuh.
- SSE hanya owner admin/peserta sesi: snapshot atomik, 100 event buffer per sesi,
  200 room maksimum, 500 stream maksimum, queue per stream 32. Klien lambat diputus.
  Last-Event-ID berisi epoch+sequence; cursor usang/restart/malformed mendapat `resync`.
  Heartbeat tiap 20 detik tanpa ACK; abort membersihkan timer dan subscription;
  expiry/logout dicek ulang setiap heartbeat.
- Payload SSE hanya judul/kode/status dan **total peserta pernah bergabung**, bukan
  peserta online. Tidak menyiarkan nama, email, cookie/token, password.
- State live buffer dan limiter in-memory, satu proses saja. Restart mereset rate
  limits/buffer, DB tetap menyimpan sesi/identitas. Belum load-tested 100 peserta.
- Activity Phase1 menyimpan owner/title/type/createdAt. Description/config/editor,
  archive/updatedAt, participant lastSeen belum diperlukan; tambah pada fase terkait.

Deploy, backup, restore: [docs/DEPLOY.md](docs/DEPLOY.md).
