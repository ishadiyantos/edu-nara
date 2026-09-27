# Edu Nara — Planning Document

> Dokumen ini menjadi acuan aktif pengembangan. Implementation Plan di `.hermes/plans/2026-09-26_184718-platform-edu-nara.md` adalah referensi historis, bukan aturan kerja yang mengalahkan dokumen ini. Detail spesifikasi per-fitur ada di **`FEATURES.md`**; prompt siap-paste untuk AI coding assistant ada di **`PROMPT.md`**.

**Goal.** Membangun platform aktivitas kelas milik sendiri yang ringan, menarik, mobile-first, dan mudah dipakai mahasiswa melalui kode sesi tanpa akun.

**Arsitektur.** Modular monolith: satu aplikasi SvelteKit, satu database SQLite, satu proses deployment. Admin/dosen wajib login; mahasiswa masuk ke sesi dengan kode + nama tampilan. Interaksi live memakai **SSE** untuk server→klien dan HTTP biasa untuk pengiriman jawaban; WebSocket baru ditambahkan bila SSE terbukti tidak cukup.

**Prinsip dev.** Ship satu vertical slice sampai tuntas (Multiple Choice) sebelum menyalin polanya ke fitur lain. Setiap versi harus bisa dipakai di kelas nyata.

---

## 1. Keputusan Produk

### Sasaran pengguna
- **Admin/dosen** — membuat aktivitas, membuka sesi, moderasi, melihat hasil, ekspor data.
- **Mahasiswa** — bergabung lewat kode/QR, isi nama tampilan, berpartisipasi tanpa akun.
- **Fase awal** — satu pemilik platform. Tidak ada organisasi, multi-tenant, marketplace, atau sistem peran kompleks.

### Prinsip UX
1. Mobile-first — mayoritas mahasiswa memakai ponsel.
2. Masuk maksimal dua langkah: buka URL/scan QR → masukkan kode & nama.
3. Satu aktivitas aktif per sesi agar layar mahasiswa tidak membingungkan.
4. Status koneksi, status jawaban, dan instruksi harus selalu terlihat.
5. Animasi ringan; hormati `prefers-reduced-motion`.
6. Kontras WCAG AA; target sentuh minimal 44×44 px; semua kontrol keyboard-accessible.
7. Bahasa UI awal: Indonesia. String dipusatkan agar i18n kelak tidak mahal.

### Batas MVP
**Termasuk:** login admin tunggal, dashboard aktivitas, kode sesi + QR, Padlet clone (papan kartu teks/tautan/gambar + moderasi), teka-teki silang (editor + player + skor), Mentimeter dasar (multiple choice + word cloud), hasil live, reset sesi, ekspor CSV.

**Tidak termasuk:** akun mahasiswa, kolaborasi banyak dosen, AI generator, gamifikasi lintas aktivitas, upload video/audio, integrasi LMS/Google Classroom, aplikasi native, analitik jangka panjang rumit.

---

## 2. Pilihan Teknis dan Alasan

### Framework
**SvelteKit sebagai full-stack framework.** Satu repo, satu bahasa, payload runtime kecil.

**Alternatif yang sengaja ditolak:**
- React/Next.js — ekosistem besar, tapi runtime & kompleksitas lebih tinggi untuk kebutuhan ini.
- Go + HTMX — sangat ringan untuk CRUD, tapi editor crossword, drag/drop papan, dan visualisasi live akan menghasilkan JavaScript ad-hoc yang lebih sulit dipelihara.
- Microservices — tidak memberi manfaat pada skala pemakaian pribadi.

### Stack lengkap
- **SvelteKit + TypeScript** (adapter-node)
- **SQLite + Drizzle ORM** (WAL mode, foreign keys ON)
- **Tailwind CSS** (~10 primitive UI, hindari component library besar)
- **Zod** — validasi input server & client
- **SSE** — server-sent events untuk update live (heartbeat + reconnect bawaan browser)
- **Vitest + Playwright** — unit/integration + E2E
- **Docker/Podman opsional** untuk deployment

### Penyimpanan
- SQLite WAL mode, satu process writer, transaksi pendek.
- File upload di volume lokal, metadata di SQLite.
- Batas awal gambar: 5 MB; JPEG/PNG/WebP saja; nama file dibuat server.
- Backup = snapshot file DB + direktori upload (atau prosedur SQLite backup aman).

### Live update
- **SSE per sesi** untuk kartu baru, moderasi, jumlah suara, word cloud.
- `POST` HTTP untuk jawaban/suara.
- WebSocket hanya bila kelak butuh komunikasi dua arah frekuensi tinggi.

### Word cloud
- Bobot kata dihitung **server**, divisualisasikan responsif di klien.
- Normalisasi: trim, lowercase, gabungkan spasi, batas panjang, blocklist opsional.
- Library layout dimuat dinamis hanya pada layar tersebut. Fallback: susunan flex dengan ukuran font berbobot.

---

## 3. Struktur Aplikasi

```text
edu-nara/
├── .env.example
├── package.json
├── svelte.config.js
├── vite.config.ts
├── drizzle.config.ts
├── src/
│   ├── app.html
│   ├── app.css
│   ├── hooks.server.ts
│   ├── lib/
│   │   ├── components/
│   │   │   ├── activity/
│   │   │   ├── board/
│   │   │   ├── crossword/
│   │   │   ├── poll/
│   │   │   └── ui/
│   │   ├── server/
│   │   │   ├── auth.ts
│   │   │   ├── db/{client.ts, schema.ts}
│   │   │   ├── events.ts          # SSE manager
│   │   │   ├── sessions.ts
│   │   │   ├── uploads.ts
│   │   │   └── validation.ts
│   │   └── types.ts
│   └── routes/
│       ├── +page.svelte
│       ├── join/
│       ├── play/[sessionCode]/
│       ├── admin/{login,activities,sessions}/
│       └── api/{join,sessions/[sessionId]/events,boards,crosswords,polls}/
├── static/
├── data/
│   ├── uploads/.gitkeep
│   └── .gitignore
├── tests/{unit,integration,e2e}/
└── Dockerfile
```

**Aturan modularitas.** Fitur boleh memiliki komponen, service server, dan validasi sendiri. **Jangan** membuat package/plugin system sebelum ada kebutuhan nyata.

### Kontrak konvensi per tipe aktivitas
Tanpa membuat sistem plugin, tiap tipe aktivitas mengikuti struktur seragam agar pola bisa disalin:

```
src/lib/components/<tipe>/{Editor,Player,Results}.svelte
src/lib/server/<tipe>.ts               (opsional; logika khusus)
src/routes/admin/activities/[id]/<tipe>/+page.svelte
src/routes/api/<tipe>/…                (endpoint spesifik)
```

Registrasi tipe cukup di `src/lib/types.ts` sebagai discriminated union — tanpa DI, tanpa registry.

---

## 4. Model Data Awal

### Entitas inti
- `admin_users` — `id, email, password_hash, created_at`
- `activities` — `id, type, title, description, config_json, status, created_at, updated_at`
- `live_sessions` — `id, activity_id, code, state (draft|open|closed|ended), started_at, ended_at`
- `participants` — `id, session_id, display_name, join_token_hash, created_at, last_seen_at`

### Padlet clone
- `board_columns` — `id, activity_id, title, position`
- `board_posts` — `id, session_id, column_id, participant_id, body, link_url, image_path, status (pending|approved|rejected|hidden), position, created_at, updated_at`
- `board_comments` — *opsional setelah posting dasar stabil*

### Crossword
- `crossword_entries` — `id, activity_id, answer, clue, row, col, direction (across|down), number`
- `crossword_attempts` — `id, session_id, participant_id, answer_state_json, score, completed_at`
- Grid **tidak** disimpan sebagai karakter duplikat; grid diturunkan dari entries dan divalidasi saat penyimpanan.

### Poll & word cloud
- `poll_questions` — `id, activity_id, kind (choice|wordcloud), prompt, position, config_json`
- `poll_options` — `id, question_id, label, position` *(hanya untuk kind=choice)*
- `poll_responses` — `id, question_id, session_id, participant_id, option_id, text_value, created_at`

### Constraint penting
- Kode sesi unik & sulit ditebak.
- Satu respons per peserta per pertanyaan, kecuali konfigurasi mengizinkan pengiriman ulang.
- Foreign key **aktif**.
- Hapus activity → soft delete atau tolak bila masih memiliki sesi. **Jangan cascade** data hasil tanpa konfirmasi.

---

## 5. Alur Layar

### Mahasiswa
1. **Landing** — input kode sesi + tombol scan/akses QR.
2. **Join** — nama tampilan + persetujuan aturan singkat.
3. **Waiting room** — judul aktivitas, nama dosen/platform, status koneksi.
4. **Activity screen** — sesuai tipe:
   - **Board:** kolom, tambah kartu, status menunggu moderasi.
   - **Crossword:** grid, daftar petunjuk, progres, submit.
   - **Multiple choice:** pilihan besar, konfirmasi terkirim, hasil bila dibuka dosen.
   - **Word cloud:** input satu/frasa pendek, hasil live.
5. **Session ended** — ringkasan + pesan selesai.

### Admin
1. Login.
2. **Dashboard** — aktivitas terbaru, buat aktivitas, duplikasi, arsip.
3. **Editor** sesuai jenis aktivitas.
4. **Launch screen** — kode, QR, jumlah peserta.
5. **Presenter screen** — tampilan proyektor tanpa kontrol yang ramai.
6. **Control panel** — buka/tutup jawaban, tampil/sembunyikan hasil, moderasi, reset, ekspor.

---

## 6. Protokol SSE

Endpoint: `GET /api/sessions/[sessionId]/events` (autentikasi via cookie participant atau admin).

**Format event:**
```
event: <name>
id: <monotonic-id>
data: {"...json..."}
```

**Event yang dipakai MVP:**

| Event | Trigger | Payload inti |
|---|---|---|
| `session.state` | connect, buka/tutup, presenter toggle | `{state, activeQuestionId, showResults}` |
| `participant.count` | join baru | `{count}` total peserta pernah bergabung, bukan online |
| `poll.tally` | vote masuk (debounced 300 ms) | `{questionId, counts: {optionId: n}}` |
| `wordcloud.snapshot` | kata baru (debounced 300 ms) | `{questionId, words: [{word, weight}]}` |
| `board.post.new` / `board.post.moderated` / `board.post.removed` | admin/mahasiswa aksi | `{postId, columnId, status, ...}` |
| `crossword.progress` | opsional live leaderboard | `{participantId, score, filledCount}` |
| `heartbeat` | tiap 20 s | `{ts}` |

**Aturan wajib:** setiap respons submission (`POST`) mengembalikan `{ok, echo?, lastEventId}` supaya klien bisa memfilter event ganda saat reconnect. `Last-Event-ID` header di reconnect dihormati oleh server.

---

## 7. Fase Implementasi (ringkas — detail di `FEATURES.md`)

| Fase | Nama | Objective | Rilis |
|---|---|---|---|
| 0 | Validasi Konsep UI | Buktikan navigasi & identitas visual sebelum backend | — |
| 1 | Fondasi Aplikasi | App jalan, DB siap, login admin, buat sesi, SSE hidup | v0.1a |
| 2 | Multiple Choice | Vertical slice pertama end-to-end | **v0.1** |
| 3 | Word Cloud | Live agregasi + presenter polish | **v0.2** |
| 4a | Board teks + moderasi | Papan kolaborasi dasar | **v0.3** |
| 4b | Board gambar/tautan | Upload aman + link | **v0.4** |
| 5 | Crossword | Editor manual + player mobile | **v0.5** |
| 6 | Stabilitas akhir | Audit, regression, kapasitas, pemulihan; fitur sudah production | **v1.0** |

**Aturan urutan:** jangan mulai fase berikutnya sebelum **acceptance criteria** fase aktif terpenuhi.

**Aturan kerja Kanban:** workspace ini memakai satu worker aktif per profile agar perubahan fitur tidak saling menimpa. Fokus setiap task adalah alur fitur end-to-end yang bisa dipakai; smoke check dilakukan seperlunya selama implementasi. Deploy dan verifikasi utama dilakukan di Pi5. Full unit/integration/E2E/load/regression test dijalankan sebagai gate setelah fitur MVP selesai dan terdeploy, bukan berulang pada setiap perubahan kecil. Task yang terhambat runner atau scope campur harus dicatat sebagai blocker, bukan diulang tanpa bukti baru.

**Alur iterasi fitur (urutan tetap, setiap fase):**

1. Tulis source code fitur sampai alur end-to-end bisa dipakai.
2. Cek murah yang relevan; tidak wajib membuat E2E baru per fitur. Build ARM64 dilakukan di Pi 5 sebelum mengganti container aktif.
3. Stage file scope fitur, commit konvensional, `git push origin HEAD:main`, lalu verifikasi `git ls-remote origin refs/heads/main`.
4. Deploy production Pi 5 (`./scripts/deploy.sh`) dan verifikasi health aktif.
5. Test stabilitas penuh (§13) hanya di tahap akhir setelah fitur MVP terdeploy, sebelum rilis stabil v1.0; bukan setiap tag iterasi v0.x.

---

## 8. Target Performa (production build)

- JS awal landing/join: **< 100 KB gzip**
- LCP: **< 2.5 s** pada ponsel menengah/4G
- INP: **< 200 ms** untuk aksi umum
- Endpoint submit: **p95 < 300 ms** di jaringan lokal
- **100 peserta aktif** per sesi sebagai target awal (bukan janji tanpa load test)

**Cara menjaga ringan.**
- Lazy-load editor, chart, dan word-cloud layout.
- CSS/SVG native untuk bar chart (bukan chart framework).
- Kompres gambar saat upload **setelah** kebutuhan terbukti; awal cukup batas ukuran.
- Tidak ada state-management library — pakai state Svelte lokal & server data.
- Tidak ada component library besar — buat ~10 primitive UI konsisten.

---

## 9. Desain Visual Awal

**Arah:** akademik modern, hangat, bukan dashboard korporat.

- Latar netral terang; kartu putih dengan border tipis.
- Warna utama indigo/ungu; aksen teal atau amber untuk aktivitas.
- Heading tegas, body sangat terbaca.
- Tiap jenis aktivitas punya warna/ikon sendiri tetapi memakai token yang sama.
- Presenter mode: tipografi besar, kontrol tersembunyi.
- Microinteraction hanya untuk feedback kirim, hasil masuk, dan transisi state.

**Token awal (sementara — validasi lewat prototipe):**
```css
:root {
  --color-primary: #4f46e5;
  --color-accent:  #0f766e;
  --color-warning: #b45309;
  --color-danger:  #b91c1c;
  --color-bg:      #f8fafc;
  --color-surface: #ffffff;
  --color-text:    #0f172a;
  --radius-card:   1rem;
  --shadow-card:   0 8px 30px rgb(15 23 42 / 0.08);
}
```

---

## 10. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Scope membesar karena 4 produk ditiru sekaligus | Proyek tidak pernah siap dipakai | Selesaikan vertical slice Multiple Choice dulu; fitur lain ikut pola terbukti |
| Koneksi kelas tidak stabil | Respons tampak hilang | Idempotency key, reconnect SSE, status terkirim, retry terkontrol |
| Konten mahasiswa tidak pantas | Tampil di proyektor | Moderasi default untuk board/word cloud, blocklist opsional |
| Upload berbahaya | Keamanan server/pengguna | Validasi isi, ukuran, random filename, header aman, tidak eksekusi upload |
| Jawaban crossword bocor | Aktivitas tidak valid | Penilaian server-side; payload klien tidak memuat answer key |
| SQLite terkunci saat traffic spike | Respons gagal | WAL, transaksi pendek, satu process writer; load test sebelum kelas |
| UI cantik tapi sulit dipakai | Mahasiswa lambat join | Uji tugas dengan mahasiswa sebelum backend kompleks |
| Kehilangan data | Hasil kelas hilang | Backup terjadwal + uji restore nyata |

---

## 11. Open Questions & Default Aman

Keputusan berikut belum final; **default aman** dipakai sampai Anda memutuskan lain.

| # | Pertanyaan | Default aman |
|---|---|---|
| 1 | Jaringan kampus saja atau publik internet? | **Internet publik lewat HTTPS** |
| 2 | Peserta maksimum realistis per sesi? | **100** |
| 3 | Respons dihubungkan ke identitas resmi? | **Nama bebas** |
| 4 | Moderasi board/word cloud default? | **Aktif** |
| 5 | Gambar wajib pada rilis pertama board? | **Ditunda 1 versi** (fase 4b) |
| 6 | Retensi hasil sesi? | **180 hari** |
| 7 | UI multi-bahasa? | **Hanya Indonesia** |
| 8 | Nama produk & identitas visual final? | **Edu Nara (sementara)** |

---

## 12. Definition of Done per Fitur

Fitur dianggap selesai bila:

- Alur admin **dan** mahasiswa lengkap dan bisa dipakai di kelas nyata.
- Validasi **server** tersedia (validasi client menyusul bila perlu).
- State penting tersedia: loading, error, session-ended. State kosong/edge lain boleh menyusul.
- Alur utama dibuktikan dengan smoke manual atau otomatis, tanpa kewajiban menambah file E2E.
- Commit sudah dipush ke GitHub dan SHA remote cocok.
- Commit yang sama terdeploy di production Pi 5; release, health, dan fitur live terverifikasi.
- Dipakai dalam minimal satu simulasi kelas singkat.

Tidak diwajibkan per fitur: cakupan unit/integration penuh dan pengujian semua viewport. Audit luas masuk tahap stabilitas akhir; label, akses keyboard, dan validasi server tetap dibangun bersama fitur.

---

## 13. Strategi Delivery & Stabilitas

**Urutan utama:** source code fitur end-to-end → check/smoke seperlunya → commit dan push GitHub → deploy production Pi 5 → verifikasi health dan alur nyata → test stabilitas penuh di akhir / gate rilis.

### Saat membangun fitur
- Implementasikan alur yang bisa dipakai, bukan test suite terlebih dahulu.
- Jalankan hanya check murah yang membantu mencegah kerusakan langsung; jangan mengulang test sama tanpa perubahan atau bukti baru.
- Sebelum rilis fitur, satu alur manual atau E2E happy-path cukup sebagai acceptance. Jangan menunda fitur karena cakupan test.

### Tahap akhir setelah fitur MVP terdeploy / sebelum rilis stabil v1.0
```bash
npm run check && npm run lint && npm run test:unit && npm run test:integration && npm run build
npm run test:e2e
```

Jalankan suite luas sekali pada tahap stabilitas akhir, lalu ulangi bagian yang gagal setelah perbaikan. Load/soak/restore memakai staging Pi 5 dengan data terisolasi, bukan membebani atau merusak production. Perubahan auth, otorisasi, upload, migrasi destruktif, atau backup/restore wajib mendapat pemeriksaan terarah sebelum aktivasi production; ini bukan alasan menjalankan seluruh suite tiap iterasi.

### Aturan praktis
- Test mengunci perilaku yang sudah dipilih; jangan menulis test dulu saat desain fitur masih berubah.
- Unit test hanya untuk logika murni rawan bug.
- Integration test hanya untuk kontrak penting: idempotency, isolasi sesi, akses lintas aktivitas.
- Hindari test duplikat dan banyak file E2E untuk satu alur fitur.
- Stabilitas luas (viewport, regression, load) menjadi tahap akhir setelah fitur terdeploy.
