# edu-nara — Planning Document

Platform edukasi personal untuk kelas mahasiswa. Solo-dev, self-host, ringan, ekstensibel.

---

## 1. Tujuan & Batasan

| Aspek | Keputusan |
|---|---|
| Pengguna | Dosen (Anda) + 50–200 mahasiswa per sesi kelas |
| Model akses | Kode room + nama (guest, tanpa akun) — ala Mentimeter/Kahoot |
| Deployment | Self-host VPS (Docker Compose) |
| Prioritas UX | Mobile-first, cepat, animasi halus (mahasiswa buka di HP) |
| Prinsip dev | Ship kecil, iterasi cepat, satu fitur → produksi → fitur berikutnya |

**Non-goals fase awal**: multi-tenant komersial, marketplace konten, mobile app native, SSO kampus.

---

## 2. Stack Teknologi

```
┌─────────────────────────────────────────────────────────┐
│  Client (mahasiswa & dosen)                             │
│  SvelteKit 2 + Svelte 5 (runes) + TailwindCSS 4         │
│  DaisyUI (komponen siap pakai)                          │
│  Motion One / svelte-motion (animasi ringan)            │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTP + WebSocket
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Server (SvelteKit adapter-node)                        │
│  - REST/form actions untuk CRUD                         │
│  - Native ws (upgrade dari HTTP server) untuk realtime  │
│  - Lucia-style session (custom, cookie-based) utk dosen │
│  - Guest = signed cookie berisi {roomCode, displayName} │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Data                                                    │
│  SQLite (dev + prod kecil) via better-sqlite3           │
│  Drizzle ORM (typed, migrasi ringan)                    │
│  Upgrade path → Postgres tanpa ubah kode Drizzle         │
│  Redis (opsional, fase 2) untuk pub/sub multi-node ws   │
└─────────────────────────────────────────────────────────┘
```

**Kenapa stack ini**
- SvelteKit: 1 framework untuk FE+BE, bundle client kecil (~40KB), form actions bikin CRUD cepat.
- SQLite + Drizzle: zero-ops, cukup untuk 200 concurrent user; Drizzle bikin migrasi ke Postgres tinggal ganti driver.
- Tailwind + DaisyUI: UI menarik tanpa mendesain dari nol; tema mudah diganti.
- WebSocket native (bukan Socket.IO): lebih ringan, cukup untuk 1 VPS.

---

## 3. Arsitektur Modular (siap ekspansi)

```
src/
├── lib/
│   ├── server/
│   │   ├── db/              # drizzle schema + migrations
│   │   ├── auth/            # dosen session + guest cookie
│   │   ├── realtime/        # ws hub: room → clients[]
│   │   └── modules/         # ← SATU FOLDER PER TIPE AKTIVITAS
│   │       ├── padlet/
│   │       ├── crossword/
│   │       ├── wordcloud/
│   │       ├── poll/
│   │       └── quiz/        # fase 2
│   ├── components/          # tombol, modal, layout dosen/mhs
│   └── activities/          # renderer FE per tipe (mirror modules/)
└── routes/
    ├── (dosen)/             # /dashboard, /activities/new, dst
    ├── join/[code]/         # entry mahasiswa
    └── play/[code]/         # runtime aktivitas
```

**Kontrak modul aktivitas** (setiap tipe implementasi 4 hal):
1. `schema.ts` — tabel Drizzle
2. `service.ts` — create/update/aggregate
3. `handlers.ts` — HTTP + WS message handlers
4. `+page.svelte` runtime — komponen mahasiswa & tampilan dosen

Menambah fitur baru = tambah 1 folder di `modules/` + 1 di `activities/`. Tidak menyentuh kode inti.

---

## 4. Skema Data (inti)

```
users            (dosen)
  id, email, password_hash, name, created_at

rooms
  id, code (6 char, unik), owner_id, title, is_open, created_at

room_participants  (guest tracking)
  id, room_id, display_name, session_token, joined_at

activities
  id, room_id, type (padlet|crossword|wordcloud|poll|quiz),
  title, config_json, state (draft|live|closed), order_index

submissions       (generik, payload per tipe)
  id, activity_id, participant_id, payload_json, created_at
```

Tabel spesifik per modul (contoh):
- `padlet_posts` (activity_id, participant_id, text, color, x, y, image_url)
- `crossword_puzzles` (activity_id, grid_json, clues_json)
- `crossword_progress` (activity_id, participant_id, filled_json, score)
- `poll_options` (activity_id, label, order)
- `poll_votes` (option_id, participant_id)
- `wordcloud_entries` (activity_id, word, count) — aggregated

---

## 5. Realtime Protocol (WebSocket)

Endpoint tunggal: `wss://host/ws?room=ABC123&token=...`

Message JSON minimal:
```json
{ "t": "post.new", "activityId": 42, "data": { ... } }
```

Event types awal:
- `room.state` (server → client saat connect)
- `activity.changed` (dosen ganti aktivitas aktif)
- `post.new` / `post.update` / `post.delete` (padlet)
- `vote.cast` + `vote.tally` (poll)
- `word.new` + `wordcloud.snapshot` (wordcloud)
- `crossword.progress` (opsional live leaderboard)

Hub sederhana: `Map<roomCode, Set<WebSocket>>`. Broadcast di dalam room saja.

---

## 6. Roadmap Milestone

### M0 — Fondasi (target: 2–3 hari)
- [ ] Scaffold SvelteKit + Tailwind + DaisyUI + Drizzle + better-sqlite3
- [ ] Docker Compose (app + volume sqlite + caddy reverse proxy)
- [ ] Auth dosen (register/login, argon2)
- [ ] Model `rooms` + generate kode 6 karakter + QR code
- [ ] Guest join flow: `/join/ABC123` → input nama → cookie → redirect `/play/ABC123`
- [ ] WebSocket hub + heartbeat + reconnect di client
- [ ] Layout dosen (dashboard) & layout mahasiswa (mobile-first)

### M1 — Padlet clone (target: 3–4 hari)
- [ ] CRUD board (kolom bebas / grid / freeform)
- [ ] Post: teks, warna, emoji, upload gambar (local disk + resize)
- [ ] Drag-to-reorder (dosen), like/react (mahasiswa)
- [ ] Realtime `post.new/update/delete`
- [ ] Export board → PNG/PDF

### M2 — Mentimeter Word Cloud + Multiple Choice (target: 2–3 hari)
- [ ] Wordcloud: input kata (max N kata/mahasiswa) → agregasi live → visualisasi (d3-cloud atau custom SVG)
- [ ] Poll MC: dosen buat pertanyaan + opsi → mahasiswa vote sekali → bar chart live
- [ ] Mode presentasi fullscreen untuk dosen (tekan F)

### M3 — Teka-Teki Silang ala Wordwall (target: 4–5 hari)
- [ ] Editor: dosen input daftar kata + clue → generator auto-layout grid
- [ ] Runtime mahasiswa: grid interaktif, keyboard nav, auto-check
- [ ] Timer + skor + leaderboard live (opsional)
- [ ] Simpan progres per mahasiswa

### M4 — Quality of Life (target: ongoing)
- [ ] Library aktivitas reusable (duplicate ke room lain)
- [ ] Export hasil (CSV per aktivitas)
- [ ] Tema gelap/terang
- [ ] Rate limit anti-spam
- [ ] Backup otomatis SQLite (litestream ke S3-compatible)

### M5 — Kuis & Flashcard (fase 2)
- Slot arsitektur sudah disiapkan di modul `quiz/`.

---

## 7. Keputusan UI/UX

- **Halaman mahasiswa**: full-screen card, 1 aksi utama per layar, font besar, tombol besar, warna tegas (DaisyUI theme "cupcake" atau custom).
- **Halaman dosen**: sidebar kiri (daftar room), main area (aktivitas aktif), tombol "Present" ke fullscreen.
- **Animasi**: transisi halaman via `crossfade`, entri baru padlet/wordcloud pakai spring animation (motion one).
- **Loading**: skeleton, bukan spinner.
- **Empty state**: ilustrasi + CTA jelas.

---

## 8. Keamanan & Ops

- HTTPS via Caddy (auto Let's Encrypt).
- Rate limit per IP (100 req/menit) + per room (500 submission/menit).
- Input sanitization (DOMPurify server-side untuk teks padlet).
- Ukuran upload gambar max 5 MB, resize ke max 1600px.
- Backup: cron `sqlite3 .backup` → tar.gz → rclone ke storage remote (harian).
- Log: pino → file rotating.

---

## 9. Estimasi Total

- M0–M3 (padlet + wordcloud + poll + crossword): **~2–3 minggu part-time** solo.
- Setelah M3: platform sudah bisa dipakai di kelas nyata.

---

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| SQLite lock saat 200 user tulis bersamaan | WAL mode + batch write untuk wordcloud/poll |
| WebSocket drop di WiFi kampus | Auto-reconnect + resume dari `lastEventId` |
| Crossword generator lambat | Precompute di server saat "Publish", bukan saat render |
| Anda burnout karena scope creep | Roadmap ini adalah kontrak — fitur baru masuk backlog, bukan interrupt |
