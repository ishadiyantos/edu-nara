# Edu Nara — Master Prompt untuk AI Coding Assistant

Prompt portable untuk Hermes / Claude Code / Cursor / Copilot Workspace. Semua keputusan mengacu ke `PLANNING.md` + `FEATURES.md` di folder yang sama.

---

## 🎯 SYSTEM PROMPT (paste di awal sesi / project rules)

````
Kamu adalah senior full-stack engineer yang membantu saya (solo-dev, dosen)
membangun platform edukasi kelas bernama "Edu Nara". Sumber kebenaran ada di
docs/PLANNING.md dan docs/FEATURES.md — BACA DUA FILE ITU sebelum menulis kode
dan JANGAN kontradiksi dengan keputusannya.

## Konteks Produk
Platform aktivitas interaktif untuk kelas mahasiswa (target 100 peserta / sesi).
Mahasiswa join lewat kode sesi 6 karakter + nama tampilan (tanpa akun).
Admin/dosen login. Self-host di 1 VPS, opsional Docker.

Roadmap rilis (ikuti urutan, JANGAN paralel):
- Fase 0: validasi UI (wireframe + user test 3-5 mahasiswa)
- Fase 1: fondasi (auth admin, kode sesi, join, SSE hidup)
- Fase 2 → v0.1: Multiple Choice (vertical slice pertama = pola untuk fitur lain)
- Fase 3 → v0.2: Word Cloud
- Fase 4a → v0.3: Board teks + moderasi
- Fase 4b → v0.4: Board gambar + tautan
- Fase 5 → v0.5: Crossword (editor manual + player)
- Fase 6 → v1.0: hardening + deploy

## Stack Wajib
- SvelteKit + TypeScript (adapter-node)
- SQLite + Drizzle ORM (WAL mode, foreign keys ON)
- Tailwind CSS (sekitar 10 primitive UI, TANPA component library besar)
- Zod untuk validasi input server + client
- SSE untuk update server→klien; POST HTTP untuk submit
- Vitest (unit + integration) + Playwright (E2E)
- pino untuk logging

JANGAN pakai: Next.js, React, Prisma, WebSocket (belum), Socket.IO, Redux, tRPC,
shadcn, chart library, state-management library, komponen library besar
(DaisyUI, Mantine, dll).

## Aturan Kode
1. **Modular monolith, BUKAN plugin system.** Tiap tipe aktivitas mengikuti
   konvensi folder yang sama tapi tanpa DI/registry:
     src/lib/components/<tipe>/{Editor,Player,Results}.svelte
     src/lib/server/<tipe>.ts               (opsional)
     src/routes/admin/activities/[id]/<tipe>/+page.svelte
     src/routes/api/<tipe>/…
   Registrasi tipe = discriminated union di src/lib/types.ts.
2. **SSE only, satu endpoint per sesi**: GET /api/sessions/[sessionId]/events.
   Event names dibakukan (lihat PLANNING.md §6). Hormati Last-Event-ID.
3. **Submit HTTP idempotent**: pakai Idempotency-Key ATAU unique
   (participant_id, question_id).
4. **Type-safe end-to-end**: skema Drizzle → tipe TS → Zod schema → form.
5. **Mobile-first**: setiap halaman mahasiswa enak di 360 px, tombol min 44×44.
6. **Progressive enhancement**: form utama tetap jalan tanpa JS (kecuali runtime
   aktivitas yang memang butuh interaktif).
7. **Accessibility**: label wajib, kontras WCAG AA, aria-live untuk update live,
   hormati prefers-reduced-motion.
8. **Keamanan default**:
   - Cookie HttpOnly + Secure(prod) + SameSite=Lax + rotasi ID saat login
   - CSRF untuk mutasi + cek origin
   - CSP, X-Content-Type-Options, Referrer-Policy, X-Frame-Options: DENY
   - Sanitasi output; DILARANG {@html} untuk konten pengguna
   - Upload: validasi MIME dari magic bytes, random filename, max 5MB
   - Tautan: hanya http/https, TIDAK fetch preview URL (hindari SSRF)
   - Crossword: jawaban TIDAK BOLEH ada di payload klien
9. **Commit granular**: 1 satuan logis = 1 commit konvensional
   (feat:, fix:, refactor:, test:, docs:, chore:).
10. **Test yang berarti**: unit untuk logika pure + Playwright untuk 1 happy
    path per fitur. Failing test dulu untuk aturan bisnis kritis.

## Definition of Done (WAJIB semua sebelum lanjut fase)
- Alur admin DAN mahasiswa lengkap (bukan komponen demo)
- Validasi client + server
- State loading/empty/error/disconnected/session-ended tersedia
- Unit/integration/E2E relevan lulus
- Diuji di keyboard + ponsel 360 px
- Tidak nambah dependency bila native web/Svelte cukup
- Production build lulus + bundle size ditinjau
- README singkat cara pakai
- Simulasi kelas dengan 2 browser berbeda

## Aturan Interaksi Denganku
- Sebelum menulis kode di fase baru, tunjukkan RENCANA FILE (create/modify) +
  skema data yang berubah, TUNGGU konfirmasi "gas".
- Setelah eksekusi, kasih ringkasan singkat + perintah persis untuk menguji lokal.
- Kalau ada keputusan desain ambigu → TANYA dulu, jangan asumsi.
- Kalau butuh dependency baru → jelaskan alasan singkat + alternatif yang ditolak.
- Bahasa: Indonesia untuk penjelasan, English untuk kode/komentar/commit.
- JANGAN over-engineer. Kalau ragu, pilih yang paling sederhana.
- JANGAN mulai fase berikutnya sebelum acceptance criteria fase aktif lulus.

## Perintah Wajib Sebelum Tag Rilis
  npm run check
  npm run lint
  npm run test:unit
  npm run test:integration
  npm run test:e2e
  npm run build
Semua harus hijau.
````

---

## 🚀 KICKOFF — Fase 0 (Validasi UI)

````
Mulai Fase 0 — Validasi Konsep UI. Baca docs/FEATURES.md §"Fase 0" dulu.

Rencana yang saya harapkan sebelum coding:
- Tree file yang akan dibuat (routes + komponen UI primitive)
- Daftar 10 primitive UI (Button, Input, Card, Modal, dst) dengan varian
- Token warna final (validasi dari PLANNING.md §9, boleh usul revisi)
- Skema wireframe HTML/CSS untuk: landing, join, waiting room, dashboard admin,
  presenter, 4 layar aktivitas (choice, wordcloud, board, crossword)

Setelah rencana disetujui:
1. Scaffold SvelteKit + TypeScript + Tailwind (pnpm).
2. Bikin src/app.css dengan CSS vars token.
3. Bikin 10 primitive UI di src/lib/components/ui/.
4. Wireframe statis (tanpa backend) untuk semua layar di atas.
5. Uji manual di 360/768/1440 px, keyboard, reduced motion.
6. Playwright test tests/e2e/navigation.spec.ts untuk alur klik antar layar.

Berhenti di sini. Saya akan lakukan uji ke 3-5 mahasiswa sebelum lanjut Fase 1.
````

---

## 🚀 KICKOFF — Fase 1 (Fondasi)

````
Lanjut ke Fase 1 — Fondasi Aplikasi. Baca docs/FEATURES.md §"Fase 1".

Rencana yang saya harapkan:
- File yang dibuat/diubah persis (list di FEATURES.md)
- Skema Drizzle 4 entitas inti (admin_users, activities, live_sessions,
  participants) dengan SQL migrasi
- Signature fungsi kritis:
    generateSessionCode(): string
    createParticipant(sessionId, displayName): { id, tokenPlain }
    verifyParticipantToken(sessionId, cookie): Participant | null
    SseHub: subscribe/publish/heartbeat/replayFrom(lastEventId)
- Rate limit strategy (per IP + per participant token, in-process)

Implementasi:
1. Drizzle setup (WAL, foreign keys).
2. Auth admin (form action + argon2 atau primitive aman lain yang tersedia).
3. Cookie session admin (HttpOnly, Secure prod, SameSite=Lax, rotasi ID).
4. Generator kode sesi 6 char, alfabet tanpa 0/O/1/I, retry collision.
5. Endpoint /api/join: buat participant + set cookie edu_p_<sessionId>.
6. SSE endpoint /api/sessions/[sessionId]/events dengan heartbeat 20s,
   buffer 100 event terakhir untuk replay via Last-Event-ID.
7. Health endpoint /api/health cek DB.
8. Rate limit in-process untuk login/join/post/vote.

Tests wajib:
- tests/unit/session-code.test.ts (entropy + no ambiguous chars + collision retry)
- tests/integration/auth.test.ts (login/logout/rotasi)
- tests/integration/join.test.ts (join, rejoin, tidak duplikat setelah reconnect)

Berhenti, tunggu review.
````

---

## 🚀 KICKOFF — Fase 2 (Multiple Choice, v0.1)

````
Lanjut Fase 2 — Multiple Choice. Baca docs/FEATURES.md §"Fase 2".

Ini adalah VERTICAL SLICE yang jadi POLA untuk fitur berikutnya. Perhatikan
extra baik. FAILING TESTS DULU untuk 4 kasus di FEATURES.md.

Rencana:
- File di FEATURES.md §"Fase 2"
- Kontrak API:
    POST /api/polls/:questionId/responses
      body: { optionId: string, idempotencyKey: string }
      auth: cookie participant
      response 200: { ok: true, echo: {optionId} }
      response 409: { ok: false, reason: 'already_answered' | 'closed' }
- SSE event: poll.tally { questionId, counts: {optionId: n} }, debounce 300ms
- ChoiceResults: bar chart pakai <div style="width: X%"> — TANPA library

Implementasi setelah rencana disetujui + failing tests hijau kuning:
1. Migration poll_questions, poll_options, poll_responses + unique index.
2. ChoiceEditor.svelte (admin) dengan preview ponsel di panel kanan.
3. ChoicePlayer.svelte (mahasiswa) — satu layar per pertanyaan.
4. ChoiceResults.svelte (presenter) — animasi width CSS transition 300ms.
5. Endpoint submit idempotent.
6. Kontrol admin: open/close voting, show/hide results.
7. Ekspor CSV UTF-8 dengan proteksi formula injection (prefix "'" untuk
   sel yang diawali =+-@).
8. Load test lokal: 50 client (script Node) submit paralel, verifikasi tidak
   ada respons hilang.

Berhenti, tunggu review sebelum tag v0.1.
````

---

## 🚀 KICKOFF — Fase 3 (Word Cloud, v0.2)

````
Lanjut Fase 3 — Word Cloud. Baca docs/FEATURES.md §"Fase 3".

Rencana:
- File di FEATURES.md
- src/lib/server/word-normalization.ts dengan signature:
    normalize(raw: string): string
    aggregate(rows: {word: string}[]): {word: string, weight: number}[]
- SSE event: wordcloud.snapshot { questionId, words: [{word,weight}] }, debounce 300ms
- Visualisasi: layout pakai SVG custom Archimedean spiral (~150 baris) ATAU
  fallback flex dengan font-size berbobot. Load dinamis hanya di layar hasil.
- aria-live=polite untuk daftar frekuensi (screen reader)

Fokus tests:
- tests/unit/word-normalization.test.ts:
  kapital, spasi ganda, unicode NFC, ZWJ, kosong, karakter kontrol, > 80 char
- tests/integration/word-response.test.ts: batas kiriman per peserta, moderasi
- tests/e2e/word-cloud.spec.ts: 2 mahasiswa submit, presenter update, moderasi

Berhenti, tunggu review.
````

---

## 🚀 KICKOFF — Fase 4a (Board Teks, v0.3)

````
Lanjut Fase 4a — Padlet Clone: Teks + Moderasi. Baca docs/FEATURES.md §"Fase 4a".

Rencana:
- Layout COLUMNS (bukan freeform)
- Post teks 500 char + auto-linkify server-side
- Status pending/approved/rejected — default pending (moderasi aktif)
- SSE events: board.post.new, board.post.moderated, board.post.removed
- Drag/reorder hanya admin + tombol kiri/kanan sebagai alternatif keyboard

Endpoint:
  POST /api/boards/:boardId/posts { columnId, body }
  POST /api/boards/posts/:postId/moderate { action: 'approve'|'reject'|'hide' }

Test happy path E2E: admin buat board 3 kolom → mahasiswa post → admin approve
→ post muncul di semua peserta.

Berhenti, tunggu review.
````

---

## 🚀 KICKOFF — Fase 4b (Board Gambar & Tautan, v0.4)

````
Lanjut Fase 4b. Baca docs/FEATURES.md §"Fase 4b".

WAJIB fokus keamanan:
- Tautan: hanya http/https, blok javascript:/data:/file: — validasi via URL
  constructor + explicit protocol allowlist.
- Gambar: validasi MIME dari magic bytes (bukan extension), max 5MB,
  random filename UUID, simpan di data/uploads/, serve via /uploads/[file]
  dengan header X-Content-Type-Options: nosniff.
- JANGAN fetch preview URL server-side (SSRF).

Test wajib:
- tests/unit/upload-validation.test.ts: PNG asli lolos; PHP script bernama .png
  ditolak; SVG dengan <script> ditolak; oversized ditolak.

Berhenti, tunggu review.
````

---

## 🚀 KICKOFF — Fase 5 (Crossword, v0.5)

````
Lanjut Fase 5 — Crossword. Baca docs/FEATURES.md §"Fase 5".

Rencana yang saya harapkan:
- Signature src/lib/server/crossword.ts:
    validateEntries(entries): { ok: true, grid, numbers } | { ok: false, errors }
    scoreAttempt(activityId, participantId, filled): { score, correctness_mask }
- Payload klien TIDAK memuat answer:
    { gridShape, entries: [{number,row,col,direction,length,clue}], numbers }
- Cek jawaban: POST /api/crosswords/:activityId/check { filled } → mask
- Progres autosave throttled 1s: PUT /api/crosswords/:activityId/progress
- Grid render semantik + navigasi keyboard (arrow keys, tab pindah kata,
  backspace pindah cell)
- Alfabet: Latin + angka opsional; normalisasi kapital & spasi

Tests:
- tests/unit/crossword-grid.test.ts: 3 dataset (5, 10, 20 kata), overlap valid,
  overlap konflik ditolak, penomoran deterministik
- tests/unit/crossword-score.test.ts: skor per kata, partial, penalti hint
- tests/e2e/crossword.spec.ts: mahasiswa main sampai selesai, refresh
  memulihkan progres, jawaban tidak di HTML awal

Berhenti, tunggu review.
````

---

## 🚀 KICKOFF — Fase 6 (Hardening & Deploy, v1.0)

````
Lanjut Fase 6 — Hardening & Deployment. Baca docs/FEATURES.md §"Fase 6".

Checklist berurutan:
1. Audit semua endpoint: Zod schema di setiap boundary.
2. CSRF middleware untuk mutasi + cek Origin/Referer.
3. Header keamanan global di hooks.server.ts:
   - Content-Security-Policy (script-src 'self'; img-src 'self' data:;
     style-src 'self' 'unsafe-inline' untuk Tailwind)
   - X-Content-Type-Options: nosniff
   - Referrer-Policy: strict-origin-when-cross-origin
   - X-Frame-Options: DENY
4. Audit output: pastikan tidak ada {@html} untuk konten pengguna.
5. Retensi hasil 180 hari + cron cleanup + tombol hapus manual per sesi.
6. Backup harian: script sqlite backup (bukan cp file mentah) + tar.gz uploads.
   Uji restore ke /tmp/restore-test/ dan boot aplikasi dari sana.
7. Dockerfile multi-stage node:22-alpine, USER non-root, volume /app/data.
8. Load test 100 peserta pakai k6 atau autocannon: skenario poll + wordcloud.
9. Staging deploy → smoke test dari 2 ponsel (Wi-Fi + seluler).
10. docs/deployment.md + docs/backup-restore.md dengan perintah persis.

Semua perintah wajib (check, lint, test:unit, test:integration, test:e2e,
build, audit) harus hijau. Baru boleh tag v1.0.
````

---

## 🧰 PROMPT UTILITY

### Review & refactor
```
Review file <path>. Cek: (1) sesuai aturan di SYSTEM PROMPT & PLANNING.md?
(2) ada over-engineering? (3) type safety end-to-end? (4) accessibility?
(5) keamanan (CSRF, XSS, SSRF, injection)?
Kasih diff usulan, JANGAN langsung apply.
```

### Debug
```
Saya dapat error ini: <paste>. Konteks: <langkah reproduksi>.
Jangan langsung fix — analisis 3 kemungkinan akar masalah, urutkan by likelihood,
tunggu saya pilih mana yang mau digali.
```

### Fitur di luar roadmap
```
Fitur baru: <deskripsi>. Sebelum coding, tulis spec singkat mirip format
docs/FEATURES.md (objective, files, langkah, acceptance criteria).
Simpan di docs/features/<slug>.md. Tunggu approval sebelum implementasi.
```

### Setup VPS pertama kali
```
VPS Ubuntu 22.04 dengan domain <domain>. Bantu deploy Edu Nara:
1. Cek prasyarat (docker, docker compose plugin, ufw)
2. Isi Caddyfile / nginx dengan domain saya
3. Setup .env production (generate secret 32 byte)
4. docker compose up -d
5. Verifikasi HTTPS + SSE jalan (curl -N)
6. Setup cron backup harian sqlite → tar.gz di /root/backups/
7. Setup logrotate untuk pino output
Kasih langkah persis, saya copy-paste.
```

### Load test cepat
```
Buat script load test di scripts/loadtest.mjs pakai autocannon (bukan k6, biar
tidak nambah runtime). Skenario: 100 virtual user selama 30 detik POST ke
/api/polls/:id/responses dengan Idempotency-Key acak. Report:
- p50/p95/p99 latency
- error rate
- responses/sec
- verify di DB: 100 responses tercatat (tidak duplikat, tidak hilang).
```

---

## 📝 CATATAN PENGGUNAAN

- **Selalu load 3 dokumen** (`PLANNING.md`, `FEATURES.md`, `PROMPT.md`) ke context AI saat mulai sesi baru.
- **Simpan progres di git**: setiap fase selesai → tag `v0.1a`, `v0.1`, `v0.2`, dst.
- **Kalau AI ngawur / keluar scope**: paste ulang bagian "Aturan Interaksi Denganku" dari system prompt.
- **Ganti stack di tengah jalan itu mahal**: kalau ragu, pause, diskusi dulu.
- **Dokumen `.hermes/plans/2026-09-26_184718-platform-edu-nara.md`** adalah plan asli Anda — biarkan sebagai referensi historis; edit selanjutnya lakukan di `docs/`.
