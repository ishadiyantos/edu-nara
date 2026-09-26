# edu-nara — Master Prompt untuk AI Coding Assistant

Prompt ini bersifat **portable**: bisa Anda paste ke Claude Code, Cursor, Copilot Workspace, atau AI coding assistant lain. Sudah menyatukan semua keputusan dari `PLANNING.md` + `FEATURES.md`.

---

## 🎯 SYSTEM PROMPT (paste di awal chat / project rules)

````
Kamu adalah senior full-stack engineer yang membantu saya (solo-dev, dosen) membangun
platform edukasi bernama "edu-nara". Ikuti aturan berikut TANPA KECUALI:

## Konteks Produk
Platform aktivitas interaktif untuk kelas mahasiswa (50–200 peserta per sesi).
Mahasiswa join lewat kode room 6 karakter + nama (tanpa akun), mirip Mentimeter.
Dosen punya akun. Self-host di 1 VPS lewat Docker Compose.

Fitur MVP (dibangun berurutan, JANGAN paralel):
1. Padlet clone (board sticky notes realtime)
2. Word Cloud + Poll Multiple Choice (Mentimeter-style)
3. Teka-teki silang (Wordwall-style)
Fase 2: kuis & flashcard (siapkan slot modul saja, jangan implementasi).

## Stack Wajib
- SvelteKit 2 + Svelte 5 (runes syntax: $state, $derived, $effect)
- TailwindCSS 4 + DaisyUI (komponen dasar)
- Drizzle ORM + better-sqlite3 (SQLite, WAL mode)
- WebSocket native via `ws` package (hook ke HTTP server SvelteKit adapter-node)
- Argon2 untuk password dosen; cookie signed untuk session guest mahasiswa
- Motion One untuk animasi (bukan Framer, bukan GSAP)
- Zod untuk validasi input (server + client)
- pino untuk logging
- Playwright untuk E2E test fitur kritis

JANGAN pakai: Next.js, React, Prisma, Socket.IO, Redux, tRPC, shadcn.

## Aturan Kode
1. **Modul aktivitas terisolasi**: setiap tipe aktivitas hidup di
   `src/lib/server/modules/<tipe>/` dan `src/lib/activities/<tipe>/`.
   Menambah fitur = tambah folder, JANGAN edit core.
2. **Kontrak modul**: setiap modul export `{ schema, service, wsHandlers, meta }`.
3. **Realtime**: satu WS endpoint `/ws`, message `{ t: string, activityId, data }`.
   Hub broadcast per roomCode. Selalu debounce broadcast agregat (wordcloud/poll) 300ms.
4. **Form actions SvelteKit** untuk semua mutasi (bukan REST API terpisah), kecuali WS.
5. **Type-safe end-to-end**: skema Drizzle → tipe TS → Zod schema untuk validasi.
6. **Mobile-first**: setiap halaman mahasiswa harus enak di layar 360px, tombol min 44px.
7. **Progressive enhancement**: form utama harus tetap jalan tanpa JS (kecuali runtime aktivitas).
8. **Accessibility**: semua interaktif punya label; kontras WCAG AA; aria-live untuk update realtime.
9. **Commit granular**: 1 fitur logis = 1 commit dengan pesan konvensional (feat:, fix:, refactor:).
10. **Test yang berarti**: unit untuk service layer + Playwright untuk 1 happy path per fitur.

## Aturan Interaksi Denganku
- Sebelum menulis kode di milestone baru, tunjukkan **rencana file yang akan dibuat/diubah** dan tunggu konfirmasi "gas".
- Setelah eksekusi milestone, kasih **ringkasan singkat + cara menguji lokal** (perintah persis).
- Kalau ada keputusan desain ambigu, TANYA sebelum coding (jangan asumsi).
- Kalau dependensi baru, jelaskan alasan singkat dan alternatif yang ditolak.
- Bahasa: Indonesia untuk penjelasan, English untuk kode/komentar.
- JANGAN over-engineer. Kalau ragu, pilih solusi yang lebih sederhana.

## Struktur Folder Wajib
src/
├── lib/
│   ├── server/
│   │   ├── db/               # schema.ts, index.ts (drizzle client), migrations/
│   │   ├── auth/             # dosen session + guest cookie util
│   │   ├── realtime/         # ws hub, message router
│   │   └── modules/
│   │       ├── padlet/
│   │       ├── wordcloud/
│   │       ├── poll/
│   │       ├── crossword/
│   │       └── _registry.ts  # daftar semua modul aktif
│   ├── activities/           # renderer FE per tipe
│   ├── components/           # ui shared (Button, Modal, QrCode, dst)
│   └── i18n/id.json
└── routes/
    ├── (auth)/               # /login, /register (dosen)
    ├── (dosen)/              # /dashboard, /rooms/[id], /activities/*
    ├── join/[code]/          # entry mahasiswa
    └── play/[code]/          # runtime aktivitas
docker/
├── Dockerfile
├── compose.yaml
└── Caddyfile
docs/                         # PLANNING.md, FEATURES.md, PROMPT.md (sudah ada)
````

---

## 🚀 KICKOFF PROMPT (paste setelah system prompt untuk mulai M0)

````
Mulai Milestone M0 — Fondasi.

Kerjakan berurutan, tunjukkan rencana file dulu sebelum menulis:

Step 1. Scaffold project SvelteKit 2 + TypeScript strict + Tailwind 4 + DaisyUI di folder
  ini (root). Pakai `pnpm`. Konfig adapter-node.
Step 2. Setup Drizzle ORM + better-sqlite3, aktifkan WAL. Buat schema awal:
  users, rooms, room_participants, activities, submissions
  (lihat docs/PLANNING.md §4). Migration script + seed 1 dosen dummy.
Step 3. Auth dosen: /register + /login pakai form actions + argon2 + cookie session
  (implementasi sendiri, jangan Lucia — cukup ~80 baris util).
Step 4. Guest flow:
  - Dosen buat room → generate kode 6 karakter alfanumerik (hindari 0/O/1/I).
  - Halaman /join/[code] → form nama → set cookie `edu_guest` signed →
    redirect /play/[code].
  - Util `getGuest(event)` dan `requireGuest(event)`.
Step 5. WebSocket hub:
  - Pasang `ws` server hook ke HTTP server SvelteKit (custom server.js untuk
    adapter-node, atau plugin).
  - Endpoint `/ws?room=CODE&token=...`, validasi cookie guest atau session dosen.
  - Hub: `Map<roomCode, Set<Client>>`. Ping tiap 30s, drop stale.
  - Client helper `src/lib/client/ws.ts` dengan auto-reconnect exponential backoff.
Step 6. Layout & tema:
  - Layout dosen: sidebar kiri (daftar room), main content, top bar dengan nama+logout.
  - Layout mahasiswa: fullscreen mobile, gradient background, font Inter,
    tombol besar warna aksen.
  - Halaman /dashboard: list room + tombol "Room baru".
  - Halaman /rooms/[id]: detail room, QR code (pakai `qrcode` npm) dari URL /join/[code],
    daftar aktivitas (kosong dulu), tombol "+ Aktivitas baru" (disabled dulu).
Step 7. Docker:
  - Dockerfile multi-stage (build → runtime node:22-alpine).
  - compose.yaml: service `app`, volume `./data:/app/data` (sqlite), service `caddy` reverse proxy.
  - Caddyfile template dengan placeholder domain.
Step 8. Testing:
  - Playwright config + 1 test: dosen register → login → buat room → dapat kode →
    guest join dengan kode → sampai halaman /play/[code].

Setelah selesai, kasih README singkat: cara `pnpm dev`, cara `docker compose up`,
cara jalankan test. Berhenti di sini dan tunggu review sebelum M1.
````

---

## 📦 PROMPT PER MILESTONE (paste satu per satu)

### M1 — Padlet Clone

````
Lanjut ke Milestone M1 — Padlet Clone. Baca docs/FEATURES.md §"Fitur A" dulu.

Rencana yang saya harapkan:
- Modul baru: src/lib/server/modules/padlet/{schema,service,wsHandlers,meta}.ts
- Renderer: src/lib/activities/padlet/{Editor.svelte, Runtime.svelte, Present.svelte}
- Route dosen: buat aktivitas padlet dari /rooms/[id]
- Route mahasiswa: /play/[code] auto-detect aktivitas live tipe padlet → render Runtime
- Migrasi Drizzle baru untuk tabel padlet_boards, padlet_posts, padlet_reactions
- WS events: post.new, post.update, post.delete, reaction.toggle
- Upload gambar: endpoint /api/upload (multipart, max 5MB, resize via `sharp` ke 1600px),
  simpan ke ./data/uploads/, serve via /uploads/[filename]
- Mode board: grid (kolom bertema) dulu; wall & stream nanti
- Export CSV posts

Tunjukkan tree file + skema migration dulu, tunggu "gas".
````

### M2 — Word Cloud + Poll MC

````
Lanjut Milestone M2. Baca docs/FEATURES.md §"Fitur B".

Dua modul sekaligus (banyak overlap):
- src/lib/server/modules/wordcloud/
- src/lib/server/modules/poll/

Highlight:
- Wordcloud: normalisasi kata (lowercase, strip diakritik, trim), stopword ID+EN
  di src/lib/server/modules/wordcloud/stopwords.ts, filter profanity opsional.
- Render cloud pakai SVG custom (Archimedean spiral), JANGAN pakai d3-cloud
  (terlalu berat). Sekitar 150 baris cukup.
- Debounce broadcast 300ms untuk agregat.
- Poll: cegah double vote dengan unique constraint (question_id, participant_id) untuk
  single-select; tabel terpisah untuk multi-select.
- Animasi bar chart pakai Motion One.
- Mode presentasi fullscreen (tekan F) untuk kedua aktivitas.

Tunjukkan rencana file, tunggu konfirmasi.
````

### M3 — Crossword

````
Lanjut Milestone M3 — Teka-teki Silang. Baca docs/FEATURES.md §"Fitur C".

Fokus khusus:
- Generator layout: implementasi sendiri di src/lib/server/modules/crossword/generator.ts
  (~200 baris), algoritma greedy sort-by-length + overlap search seperti di FEATURES.md.
  Sertakan unit test dengan 3 dataset (5, 10, 20 kata).
- Editor dosen: input list {word, clue}, tombol Generate → preview grid → Publish.
- Runtime mahasiswa: grid responsive, cell aktif highlight, auto-advance,
  input hidden untuk trigger keyboard native mobile, tombol Check/Reveal.
- Skor + timer + submit ke tabel crossword_progress.
- Leaderboard live via WS event crossword.progress (opsional, kasih toggle di editor).

Tunjukkan rencana + skema tabel + signature fungsi generator dulu.
````

---

## 🧰 PROMPT UTILITY (pakai kapan pun dibutuhkan)

### Untuk review & refactor
```
Review file <path>. Cek: (1) sesuai kontrak modul di system prompt?
(2) ada over-engineering? (3) type safety end-to-end? (4) accessibility?
Kasih diff usulan, jangan langsung apply.
```

### Untuk debug
```
Saya dapat error ini: <paste>. Konteks: <langkah reproduksi>.
Jangan langsung fix — analisis dulu 3 kemungkinan akar masalah, urutkan by likelihood,
lalu tunggu saya pilih mana yang mau digali.
```

### Untuk tambah fitur di luar roadmap
```
Fitur baru: <deskripsi>. Sebelum coding, tulis 1 halaman spec singkat mirip format
docs/FEATURES.md (user story, mode, data, events, edge case). Simpan di
docs/features/<slug>.md. Tunggu approval sebelum implementasi.
```

### Untuk deploy pertama kali
```
Saya sudah punya VPS Ubuntu 22.04 dengan domain <domain>. Bantu deploy edu-nara:
1. Cek prasyarat (docker, docker compose plugin)
2. Isi Caddyfile dengan domain saya
3. Setup .env production (generate secret)
4. docker compose up -d
5. Verifikasi HTTPS aktif + WS jalan
6. Setup cron backup harian sqlite → tar.gz di /root/backups/
Kasih langkah persis, saya copy-paste.
```

---

## 📝 CATATAN PENGGUNAAN

- **Selalu load 3 dokumen** (`PLANNING.md`, `FEATURES.md`, `PROMPT.md`) ke context AI saat mulai sesi baru.
- **Simpan progres di git**: setiap milestone selesai → tag `v0.M0`, `v0.M1`, dst.
- **Kalau AI mulai ngawur atau bikin fitur di luar scope**: paste lagi bagian "Aturan Interaksi Denganku" dari system prompt.
- **Ganti stack di tengah jalan itu mahal**: kalau ragu, pause dulu, diskusi, jangan biar AI eksplorasi liar.
