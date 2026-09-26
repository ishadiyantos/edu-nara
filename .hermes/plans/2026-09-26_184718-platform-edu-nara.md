# Edu Nara Implementation Plan

> **For Hermes:** Implementasikan rencana ini per fase. Jangan membangun fase berikutnya sebelum acceptance criteria fase aktif terpenuhi.

**Goal:** Membangun platform aktivitas kelas milik sendiri yang ringan, menarik, mobile-first, dan mudah dipakai mahasiswa melalui kode sesi tanpa akun.

**Architecture:** Mulai sebagai modular monolith: satu aplikasi SvelteKit, satu database SQLite, satu proses deployment. Admin/dosen wajib login; mahasiswa masuk ke sesi dengan kode dan nama tampilan. Interaksi live memakai Server-Sent Events (SSE) untuk pembaruan server-ke-klien dan HTTP biasa untuk pengiriman jawaban; WebSocket baru ditambahkan bila SSE terbukti tidak cukup.

**Tech Stack:** SvelteKit + TypeScript, SQLite, Drizzle ORM, Tailwind CSS, Zod, Vitest, Playwright, adapter-node, Docker/Podman opsional untuk deployment.

---

## 1. Keputusan Produk

### Sasaran pengguna

- **Admin/dosen:** membuat aktivitas, membuka sesi, memoderasi konten, melihat hasil, mengekspor data.
- **Mahasiswa:** bergabung lewat kode/QR, mengisi nama, lalu berpartisipasi tanpa membuat akun.
- **Fase awal:** satu pemilik platform. Tidak ada organisasi, multi-tenant, marketplace template, atau sistem peran kompleks.

### Prinsip UX

1. Mobile-first; mayoritas mahasiswa memakai ponsel.
2. Masuk maksimal dua langkah: buka URL/scan QR, masukkan kode dan nama.
3. Satu aktivitas aktif per sesi agar layar mahasiswa tidak membingungkan.
4. Status koneksi, status jawaban, dan instruksi harus selalu terlihat.
5. Animasi ringan; hormati `prefers-reduced-motion`.
6. Kontras WCAG AA, target sentuh minimal 44×44 px, semua kontrol bisa dipakai via keyboard.
7. Bahasa UI awal: Indonesia. String UI dipusatkan agar internasionalisasi kelak tidak mahal.

### Batas MVP

Termasuk:

- Login admin tunggal.
- Dashboard aktivitas.
- Kode sesi dan QR.
- Clone Padlet dasar: papan kartu dengan teks, tautan, gambar, komentar opsional, moderasi.
- Teka-teki silang: editor grid dan petunjuk, mode bermain, skor sederhana.
- Mentimeter dasar: multiple choice dan word cloud.
- Hasil live, reset sesi, ekspor CSV.

Tidak termasuk:

- Akun mahasiswa.
- Kolaborasi banyak dosen.
- AI generator.
- Gamifikasi lintas aktivitas.
- Video/audio upload.
- Integrasi LMS/Google Classroom.
- Aplikasi native.
- Analitik jangka panjang yang rumit.

---

## 2. Pilihan Teknis dan Alasan

### Frontend/backend

**Rekomendasi: SvelteKit sebagai full-stack framework.** Satu repo dan satu bahasa menekan biaya pemeliharaan. Svelte mengompilasi komponen sehingga payload runtime kecil dan cocok untuk UI interaktif.

Alternatif yang sengaja tidak dipilih:

- React/Next.js: ekosistem besar, tetapi runtime dan kompleksitas lebih tinggi untuk kebutuhan ini.
- Go + HTMX: sangat ringan untuk CRUD, tetapi editor crossword, drag/drop papan, dan visualisasi live akan menghasilkan JavaScript ad-hoc yang lebih sulit dipelihara.
- Microservices: tidak memberi manfaat pada skala pemakaian pribadi.

### Penyimpanan

- SQLite dengan WAL mode.
- File upload disimpan di volume lokal, metadata di SQLite.
- Batas awal gambar: 5 MB; JPEG/PNG/WebP saja; nama file dibuat server.
- Backup cukup dengan snapshot file database dan direktori upload saat aplikasi dihentikan atau memakai prosedur SQLite backup yang aman.

### Live update

- SSE per sesi untuk kartu baru, moderasi, jumlah suara, dan word cloud.
- `POST` HTTP untuk jawaban/suara.
- Heartbeat dan reconnect otomatis bawaan browser.
- WebSocket hanya bila kelak membutuhkan komunikasi dua arah berfrekuensi tinggi.

### Word cloud

- MVP: bobot kata dihitung server, divisualisasikan responsif di klien.
- Normalisasi: trim, lowercase, gabungkan spasi, batas panjang, daftar kata terlarang opsional.
- Library layout word cloud dimuat dinamis hanya pada layar tersebut. Jika ukuran bundle atau aksesibilitas buruk, gunakan susunan flex dengan ukuran font berbobot sebagai fallback.

---

## 3. Struktur Aplikasi yang Direncanakan

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
│   │   │   ├── db/
│   │   │   │   ├── client.ts
│   │   │   │   └── schema.ts
│   │   │   ├── events.ts
│   │   │   ├── sessions.ts
│   │   │   ├── uploads.ts
│   │   │   └── validation.ts
│   │   └── types.ts
│   └── routes/
│       ├── +page.svelte
│       ├── join/
│       ├── play/[sessionCode]/
│       ├── admin/
│       │   ├── login/
│       │   ├── activities/
│       │   └── sessions/
│       └── api/
│           ├── join/
│           ├── sessions/[sessionId]/events/
│           ├── boards/
│           ├── crosswords/
│           └── polls/
├── static/
├── data/
│   ├── uploads/.gitkeep
│   └── .gitignore
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── Dockerfile
```

Aturan modularitas: fitur boleh memiliki komponen, service server, dan validasi sendiri. Jangan membuat package/plugin system sebelum ada kebutuhan nyata.

---

## 4. Model Data Awal

### Entitas inti

- `admin_users`: `id`, `email`, `password_hash`, `created_at`.
- `activities`: `id`, `type`, `title`, `description`, `config_json`, `status`, timestamps.
- `live_sessions`: `id`, `activity_id`, `code`, `state`, `started_at`, `ended_at`.
- `participants`: `id`, `session_id`, `display_name`, `join_token_hash`, timestamps.

### Padlet clone

- `board_columns`: `id`, `activity_id`, `title`, `position`.
- `board_posts`: `id`, `session_id`, `column_id`, `participant_id`, `body`, `link_url`, `image_path`, `status`, `position`, timestamps.
- `board_comments`: opsional setelah posting dasar stabil.

### Crossword

- `crossword_entries`: `id`, `activity_id`, `answer`, `clue`, `row`, `col`, `direction`, `number`.
- `crossword_attempts`: `id`, `session_id`, `participant_id`, `answer_state_json`, `score`, `completed_at`.

Grid tidak disimpan sebagai karakter duplikat; grid diturunkan dari entries dan divalidasi saat penyimpanan.

### Poll dan word cloud

- `poll_questions`: `id`, `activity_id`, `kind`, `prompt`, `position`, `config_json`.
- `poll_options`: `id`, `question_id`, `label`, `position`.
- `poll_responses`: `id`, `question_id`, `session_id`, `participant_id`, `option_id`, `text_value`, timestamp.

Constraint penting:

- Kode sesi unik dan sulit ditebak.
- Satu respons per peserta per pertanyaan, kecuali konfigurasi mengizinkan pengiriman ulang.
- Foreign key aktif.
- Hapus activity memakai soft delete atau ditolak bila masih memiliki sesi; jangan cascade data hasil tanpa konfirmasi.

---

## 5. Alur Layar

### Mahasiswa

1. Landing page: input kode sesi dan tombol scan/akses QR.
2. Join page: nama tampilan dan persetujuan aturan singkat.
3. Waiting room: judul aktivitas, nama dosen/platform, status koneksi.
4. Activity screen:
   - Board: kolom, tambah kartu, status menunggu moderasi.
   - Crossword: grid, daftar petunjuk, progres, submit.
   - Multiple choice: pilihan besar, konfirmasi terkirim, hasil bila dibuka dosen.
   - Word cloud: input satu/frasa pendek, hasil live.
5. Session ended: ringkasan dan pesan selesai.

### Admin

1. Login.
2. Dashboard: aktivitas terbaru, buat aktivitas, duplikasi, arsip.
3. Editor sesuai jenis aktivitas.
4. Launch screen: kode, QR, jumlah peserta.
5. Presenter screen: tampilan proyektor tanpa kontrol yang ramai.
6. Control panel: buka/tutup jawaban, tampil/sembunyikan hasil, moderasi, reset, ekspor.

---

## 6. Fase Implementasi

## Fase 0 — Validasi Konsep UI

**Objective:** Membuktikan navigasi dan identitas visual sebelum membuat backend.

**Files:**
- Create: `src/routes/+page.svelte`
- Create: `src/routes/join/+page.svelte`
- Create: `src/routes/admin/+layout.svelte`
- Create: `src/app.css`
- Test: `tests/e2e/navigation.spec.ts`

Langkah:

1. Tentukan nama sementara, warna utama, font lokal/system, radius, shadow, spacing, dan state komponen.
2. Buat wireframe landing, join, dashboard, presenter, dan empat layar aktivitas.
3. Uji pada lebar 360 px, 768 px, dan 1440 px.
4. Uji keyboard, kontras, reduced motion, serta loading/empty/error state.
5. Minta 3–5 mahasiswa menyelesaikan alur join dari QR sampai mengirim jawaban.

**Acceptance criteria:** median join di bawah 30 detik; mahasiswa tidak perlu penjelasan verbal untuk menemukan tombol kirim.

## Fase 1 — Fondasi Aplikasi

**Objective:** Aplikasi bisa dijalankan, menyimpan data, login admin, dan membuat sesi.

**Files:**
- Create: `src/lib/server/db/schema.ts`
- Create: `src/lib/server/db/client.ts`
- Create: `src/lib/server/auth.ts`
- Create: `src/lib/server/sessions.ts`
- Create: `src/hooks.server.ts`
- Create: `src/routes/admin/login/+page.server.ts`
- Create: `src/routes/api/join/+server.ts`
- Test: `tests/unit/session-code.test.ts`
- Test: `tests/integration/auth.test.ts`
- Test: `tests/integration/join.test.ts`

Langkah:

1. Bootstrap SvelteKit TypeScript dan scripts lint/check/test/build.
2. Pasang SQLite + Drizzle; aktifkan WAL dan foreign keys.
3. Buat migration untuk empat entitas inti.
4. Buat admin seed berbasis environment variable; hash password memakai primitive yang aman dan tersedia.
5. Buat cookie session `HttpOnly`, `Secure` di production, `SameSite=Lax`, dengan rotasi ID saat login.
6. Buat generator kode sesi dengan entropy memadai dan retry pada collision.
7. Buat alur join anonim dengan token peserta acak dalam cookie.
8. Tambah rate limit in-process untuk login, join, posting, dan voting. Untuk satu instance ini cukup; pindahkan ke Redis hanya bila multi-instance.
9. Buat SSE manager dan endpoint event dengan heartbeat serta cleanup koneksi.
10. Tambah health endpoint yang memeriksa proses dan koneksi database.

**Acceptance criteria:** admin login; activity kosong dapat dibuat; sesi menghasilkan kode; dua browser dapat join; reconnect tidak menggandakan peserta.

## Fase 2 — Multiple Choice

**Objective:** Aktivitas paling sederhana selesai end-to-end dan menjadi pola fitur berikutnya.

**Files:**
- Create: `src/lib/components/poll/ChoiceEditor.svelte`
- Create: `src/lib/components/poll/ChoicePlayer.svelte`
- Create: `src/lib/components/poll/ChoiceResults.svelte`
- Create: `src/routes/admin/activities/[id]/poll/+page.svelte`
- Create: `src/routes/api/polls/[questionId]/responses/+server.ts`
- Test: `tests/unit/poll-validation.test.ts`
- Test: `tests/integration/poll-response.test.ts`
- Test: `tests/e2e/multiple-choice.spec.ts`

Langkah:

1. Buat failing tests untuk minimal dua opsi, opsi kosong, duplikasi respons, dan sesi tertutup.
2. Buat editor pertanyaan dan opsi dengan preview ponsel.
3. Buat endpoint submit idempotent.
4. Siarkan aggregate count, bukan data peserta, lewat SSE.
5. Buat presenter results berupa bar chart CSS/SVG, tanpa chart framework.
6. Tambah kontrol tampil/sembunyikan hasil dan buka/tutup voting.
7. Tambah ekspor CSV UTF-8.

**Acceptance criteria:** 50 klien lokal dapat memilih tanpa respons hilang; refresh mempertahankan pilihan; hasil tidak bocor sebelum admin membukanya.

## Fase 3 — Word Cloud

**Objective:** Mahasiswa mengirim kata/frasa dan presenter melihat agregasi live.

**Files:**
- Create: `src/lib/components/poll/WordCloudEditor.svelte`
- Create: `src/lib/components/poll/WordCloudPlayer.svelte`
- Create: `src/lib/components/poll/WordCloudResults.svelte`
- Create: `src/lib/server/word-normalization.ts`
- Test: `tests/unit/word-normalization.test.ts`
- Test: `tests/integration/word-response.test.ts`
- Test: `tests/e2e/word-cloud.spec.ts`

Langkah:

1. Tetapkan batas 1–5 kata dan panjang maksimum 80 karakter.
2. Buat normalisasi deterministik dan tests untuk kapital, spasi, Unicode, input kosong, serta karakter kontrol.
3. Tambah konfigurasi jumlah kiriman per peserta dan moderasi sebelum tampil.
4. Agregasikan kata di SQL/server.
5. Buat visualisasi responsif; sertakan daftar frekuensi tersembunyi/alternatif untuk screen reader.
6. Batasi frekuensi animasi update agar proyektor tidak tersendat.

**Acceptance criteria:** varian kapital/spasi tergabung; konten belum disetujui tidak tampil; 200 respons tetap lancar pada laptop biasa.

## Fase 4 — Padlet Clone Dasar

**Objective:** Papan kolaborasi kartu yang bisa dimoderasi.

**Files:**
- Create: `src/lib/components/board/BoardEditor.svelte`
- Create: `src/lib/components/board/BoardView.svelte`
- Create: `src/lib/components/board/PostComposer.svelte`
- Create: `src/lib/server/uploads.ts`
- Create: `src/routes/api/boards/[boardId]/posts/+server.ts`
- Create: `src/routes/api/boards/posts/[postId]/moderate/+server.ts`
- Test: `tests/unit/upload-validation.test.ts`
- Test: `tests/integration/board-post.test.ts`
- Test: `tests/e2e/board.spec.ts`

Langkah:

1. Buat layout freeform sederhana atau columns; untuk MVP pilih columns agar mobile dan aksesibilitas lebih baik.
2. Buat teks-only post lebih dulu.
3. Tambah moderasi pending/approved/rejected.
4. Tambah tautan dengan validasi skema `http/https`; jangan fetch preview URL pada MVP agar menghindari SSRF.
5. Tambah gambar dengan validasi MIME berdasarkan isi, ukuran, random filename, dan penyajian dari origin yang aman.
6. Tambah drag/reorder hanya untuk admin; sediakan tombol pindah kiri/kanan sebagai alternatif keyboard.
7. Tambah komentar setelah posting inti stabil.
8. Tambah ekspor CSV dan paket ZIP gambar bila benar-benar dibutuhkan.

**Acceptance criteria:** post teks dan gambar aman terkirim; moderasi real-time; upload executable yang disamarkan sebagai gambar ditolak; papan tetap nyaman pada 360 px.

## Fase 5 — Crossword

**Objective:** Dosen membuat TTS manual dan mahasiswa memainkannya dari ponsel.

**Files:**
- Create: `src/lib/components/crossword/GridEditor.svelte`
- Create: `src/lib/components/crossword/ClueEditor.svelte`
- Create: `src/lib/components/crossword/CrosswordPlayer.svelte`
- Create: `src/lib/server/crossword.ts`
- Test: `tests/unit/crossword-grid.test.ts`
- Test: `tests/unit/crossword-score.test.ts`
- Test: `tests/e2e/crossword.spec.ts`

Langkah:

1. Tentukan alfabet MVP: huruf Latin, angka opsional; normalisasi kapital dan spasi.
2. Buat validator entries: batas grid, overlap cocok, tidak ada entry duplikat, nomor deterministik.
3. Buat editor manual untuk posisi, arah, jawaban, dan petunjuk.
4. Render grid semantik dengan navigasi keyboard dan perpindahan arah.
5. Simpan progres otomatis secara throttled.
6. Buat penilaian server-side; jangan kirim jawaban benar mentah dalam payload awal.
7. Tambah mode latihan: cek huruf, cek kata, atau cek saat submit sesuai konfigurasi.
8. Generator grid otomatis ditunda sampai data pemakaian membuktikan kebutuhan.

**Acceptance criteria:** overlap divalidasi; jawaban tidak terlihat dari HTML/JSON awal; refresh memulihkan progres; navigasi keyboard berfungsi.

## Fase 6 — Hardening dan Deployment

**Objective:** Platform aman, dapat dipulihkan, dan layak dipakai di kelas.

**Files:**
- Create: `.env.example`
- Create: `Dockerfile`
- Create: `docs/deployment.md`
- Create: `docs/backup-restore.md`
- Create: `tests/e2e/session-lifecycle.spec.ts`

Langkah:

1. Validasi seluruh input di server dengan Zod.
2. Tambah CSRF protection untuk mutation berbasis cookie dan cek origin.
3. Pasang CSP, `X-Content-Type-Options`, `Referrer-Policy`, serta frame policy.
4. Sanitasi output; hindari `{@html}` untuk konten pengguna.
5. Tentukan retensi hasil dan tombol hapus data sesi dengan konfirmasi.
6. Buat backup dan lakukan uji restore ke direktori sementara.
7. Buat Docker image non-root dan volume persisten untuk database/upload.
8. Jalankan lint, typecheck, unit, integration, E2E, build, dan audit dependency.
9. Lakukan load test realistis untuk 100 peserta pada poll/word cloud.
10. Deploy staging, lakukan smoke test dari ponsel pada Wi-Fi dan jaringan seluler.

**Acceptance criteria:** semua test lulus; restore backup terbukti; data tetap ada setelah restart container; 100 peserta simulasi tidak menghasilkan error atau kehilangan respons.

---

## 7. Strategi Testing

### Unit

- Generator kode sesi.
- Normalisasi kata.
- Validator crossword dan perhitungan skor.
- Validasi upload dan URL.
- State transition sesi.

### Integration

- Login/logout dan cookie.
- Join/rejoin sesi.
- Constraint satu respons per peserta.
- Moderasi post.
- Tutup sesi menolak respons baru.
- Ekspor CSV aman terhadap CSV formula injection.

### E2E

Gunakan Playwright dengan tiga context: admin, mahasiswa A, mahasiswa B.

Skenario wajib:

1. Admin membuat aktivitas dan membuka sesi.
2. Dua mahasiswa join dengan kode.
3. Keduanya mengirim respons.
4. Presenter menerima update live.
5. Admin menutup aktivitas.
6. Respons baru ditolak dengan pesan jelas.
7. Refresh/reconnect memulihkan state.

Perintah target:

```bash
npm run check
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

---

## 8. Target Performa

Budget awal, diukur pada production build:

- JavaScript awal landing/join: target < 100 KB gzip.
- Largest Contentful Paint: < 2,5 detik pada ponsel menengah/jaringan 4G.
- Interaction to Next Paint: < 200 ms untuk aksi umum.
- Endpoint submit: p95 < 300 ms pada jaringan lokal, tidak termasuk latency internet.
- 100 peserta aktif per sesi sebagai target awal, bukan janji tanpa load test.

Cara menjaga ringan:

- Lazy-load editor, chart, dan word-cloud layout.
- Gunakan CSS/SVG native untuk bar chart.
- Kompres gambar saat upload setelah kebutuhan terbukti; awalnya cukup batas ukuran.
- Hindari state-management library; gunakan state Svelte lokal dan server data.
- Hindari component library besar; buat sekitar 10 primitive UI yang konsisten.

---

## 9. Desain Visual Awal

Arah: akademik modern, hangat, bukan dashboard korporat.

- Latar netral terang; kartu putih dengan border tipis.
- Warna utama indigo/ungu; aksen teal atau amber untuk aktivitas.
- Heading tegas, body sangat terbaca.
- Tiap jenis aktivitas memiliki warna/ikon sendiri tetapi memakai token sama.
- Presenter mode memakai tipografi besar dan kontrol tersembunyi.
- Microinteraction hanya untuk feedback kirim, hasil masuk, dan transisi state.

Token awal:

```css
:root {
  --color-primary: #4f46e5;
  --color-accent: #0f766e;
  --color-warning: #b45309;
  --color-danger: #b91c1c;
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-text: #0f172a;
  --radius-card: 1rem;
  --shadow-card: 0 8px 30px rgb(15 23 42 / 0.08);
}
```

Token ini sementara; validasi melalui prototipe, bukan diperlakukan sebagai keputusan final.

---

## 10. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Scope membesar karena empat produk ditiru sekaligus | Proyek tidak pernah siap dipakai | Selesaikan vertical slice multiple choice lebih dulu; fitur lain mengikuti pola terbukti |
| Koneksi kelas tidak stabil | Respons tampak hilang | Idempotency key, reconnect SSE, status terkirim, retry terkontrol |
| Konten mahasiswa tidak pantas | Tampil di proyektor | Moderasi default untuk board/word cloud, blocklist opsional |
| Upload berbahaya | Keamanan server/pengguna | Validasi isi, ukuran, random filename, header aman, tidak mengeksekusi upload |
| Jawaban crossword bocor | Aktivitas tidak valid | Penilaian server-side; payload klien tidak memuat answer key |
| SQLite terkunci saat traffic spike | Respons gagal | WAL, transaksi pendek, satu process writer; load test sebelum kelas |
| UI cantik tetapi sulit digunakan | Mahasiswa lambat join | Uji tugas dengan mahasiswa sebelum backend kompleks |
| Kehilangan data | Hasil kelas hilang | Backup terjadwal dan uji restore nyata |

---

## 11. Urutan Rilis yang Disarankan

1. **v0.1:** Fondasi + multiple choice.
2. **v0.2:** Word cloud + presenter polish.
3. **v0.3:** Board teks + moderasi.
4. **v0.4:** Board gambar/tautan.
5. **v0.5:** Crossword editor manual + player.
6. **v1.0:** Backup/restore, export, accessibility pass, load test, deployment stabil.

Setiap versi harus sudah dapat dipakai dalam satu kelas nyata. Jangan menunggu semua fitur selesai untuk menguji produk.

---

## 12. Open Questions Sebelum Implementasi

Keputusan ini tidak menghalangi rencana, tetapi perlu dijawab sebelum Fase 1–4:

1. Platform hanya di jaringan kampus/home server atau harus publik di internet?
2. Berapa peserta maksimum realistis per sesi: 30, 100, atau lebih?
3. Apakah respons mahasiswa perlu dihubungkan ke identitas resmi, atau nama bebas cukup?
4. Moderasi board/word cloud default aktif atau nonaktif?
5. Apakah gambar wajib pada rilis pertama board?
6. Hasil sesi disimpan berapa lama?
7. Apakah UI hanya bahasa Indonesia?
8. Nama produk final dan identitas visual yang diinginkan?

Default aman bila belum diputuskan: internet publik lewat HTTPS, 100 peserta, nama bebas, moderasi aktif, gambar ditunda satu versi, retensi 180 hari, UI Indonesia, nama sementara **Edu Nara**.

---

## 13. Definition of Done per Fitur

Fitur dianggap selesai bila:

- Alur admin dan mahasiswa lengkap, bukan hanya komponen demo.
- Validasi client dan server tersedia.
- Loading, empty, error, disconnected, dan session-ended state tersedia.
- Unit/integration/E2E relevan lulus.
- Keyboard dan ponsel 360 px telah diuji.
- Tidak menambah dependency bila native web/API Svelte cukup.
- Production build lulus dan ukuran bundle ditinjau.
- Dokumentasi penggunaan singkat tersedia.
- Dipakai dalam minimal satu simulasi kelas dengan dua browser berbeda.
