# Edu Nara — Spesifikasi Fase & Fitur

> Companion `PLANNING.md`. Setiap fase berisi objective, files, langkah, acceptance criteria dari plan Anda + wireframe teks & catatan implementasi.

---

## Fase 0 — Validasi Konsep UI

**Objective.** Membuktikan navigasi dan identitas visual sebelum membuat backend.

**Files.**
- Create: `src/routes/+page.svelte`
- Create: `src/routes/join/+page.svelte`
- Create: `src/routes/admin/+layout.svelte`
- Create: `src/app.css`
- Test: `tests/e2e/navigation.spec.ts`

**Langkah.**
1. Tetapkan nama sementara, warna utama, font lokal/system, radius, shadow, spacing, dan state komponen.
2. Buat wireframe: landing, join, dashboard, presenter, dan 4 layar aktivitas.
3. Uji pada lebar **360 px, 768 px, 1440 px**.
4. Uji keyboard, kontras, reduced motion, loading/empty/error state.
5. Minta **3–5 mahasiswa** menyelesaikan alur join dari QR sampai kirim jawaban.

**Wireframe teks — Mahasiswa (360 px).**
```
┌─────────────────────────┐
│ Edu Nara                │
│                         │
│   ┌───────────────┐     │
│   │  KODE SESI    │     │
│   │  [_ _ _ _ _ _]│     │
│   └───────────────┘     │
│   [ Scan QR      ]      │
│   [ MASUK        ]      │
└─────────────────────────┘

Join → nama tampilan (max 24 char) → [ Bergabung ]

Waiting room:
┌─────────────────────────┐
│ ●  Terhubung            │
│ Aktivitas: "Survey UAS" │
│                         │
│   Menunggu dosen…       │
└─────────────────────────┘
```

**Acceptance criteria.** Median join **< 30 detik**; mahasiswa tidak perlu penjelasan verbal untuk menemukan tombol kirim.

---

## Fase 1 — Fondasi Aplikasi

**Objective.** Aplikasi bisa dijalankan, menyimpan data, login admin, dan membuat sesi.

**Files.**
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

**Langkah.**
1. Bootstrap SvelteKit TypeScript + scripts lint/check/test/build.
2. Pasang SQLite + Drizzle; aktifkan **WAL** dan **foreign keys**.
3. Migration untuk 4 entitas inti.
4. Admin seed berbasis environment variable; hash password dengan primitive aman & tersedia.
5. Cookie session `HttpOnly`, `Secure` di production, `SameSite=Lax`, rotasi ID saat login.
6. Generator kode sesi dengan entropy memadai + retry pada collision. Alfabet hindari `0/O/1/I`.
7. Alur join anonim dengan **token peserta acak** dalam cookie.
8. Rate limit **in-process** untuk login, join, posting, voting. Untuk single instance ini cukup — pindah ke Redis hanya bila multi-instance.
9. **SSE manager** + endpoint event dengan heartbeat + cleanup koneksi.
10. Health endpoint yang cek proses & koneksi DB.

**Catatan implementasi SSE.**
- Simpan koneksi di `Map<sessionId, Set<Client>>` in-memory.
- Setiap client dapat `lastEventId` monotonic; server buffer 100 event terakhir per sesi untuk resume saat reconnect.
- Heartbeat 20 s. Drop client bila 2 heartbeat terlewat.

**Acceptance criteria.** Admin login; activity kosong dapat dibuat; sesi menghasilkan kode; dua browser dapat join; reconnect **tidak** menggandakan peserta.

---

## Fase 2 — Multiple Choice (Rilis v0.1)

**Objective.** Aktivitas paling sederhana selesai end-to-end dan menjadi **pola** fitur berikutnya.

**Files.**
- Create: `src/lib/components/poll/ChoiceEditor.svelte`
- Create: `src/lib/components/poll/ChoicePlayer.svelte`
- Create: `src/lib/components/poll/ChoiceResults.svelte`
- Create: `src/routes/admin/activities/[id]/poll/+page.svelte`
- Create: `src/routes/api/polls/[questionId]/responses/+server.ts`
- Test: `tests/unit/poll-validation.test.ts`
- Test: `tests/integration/poll-response.test.ts`
- Test: `tests/e2e/multiple-choice.spec.ts`

**Langkah.**
1. **Failing tests dulu**: minimal 2 opsi, opsi kosong, duplikasi respons, sesi tertutup.
2. Editor pertanyaan + opsi dengan **preview ponsel** di kanan.
3. Endpoint submit **idempotent** (`Idempotency-Key` header atau `participant_id + question_id`).
4. SSE broadcast **aggregate count**, bukan data peserta.
5. Presenter results: **bar chart CSS/SVG** — jangan pakai chart framework.
6. Kontrol tampil/sembunyikan hasil + buka/tutup voting.
7. Ekspor CSV UTF-8 (waspada CSV formula injection: prefix `'` untuk sel yang diawali `=+-@`).

**Wireframe — Player mahasiswa.**
```
┌─────────────────────────┐
│ Q1 dari 1               │
│                         │
│ Apa framework terbaik?  │
│                         │
│ [  A. Svelte         ]  │
│ [  B. React          ]  │
│ [  C. Vue            ]  │
│ [  D. Solid          ]  │
│                         │
│ ● Terkirim ✓            │
└─────────────────────────┘
```

**Acceptance criteria.** 50 klien lokal bisa memilih **tanpa respons hilang**; refresh mempertahankan pilihan; hasil **tidak bocor** sebelum admin membukanya.

---

## Fase 3 — Word Cloud (Rilis v0.2)

**Objective.** Mahasiswa mengirim kata/frasa; presenter melihat agregasi live.

**Files.**
- Create: `src/lib/components/poll/WordCloudEditor.svelte`
- Create: `src/lib/components/poll/WordCloudPlayer.svelte`
- Create: `src/lib/components/poll/WordCloudResults.svelte`
- Create: `src/lib/server/word-normalization.ts`
- Test: `tests/unit/word-normalization.test.ts`
- Test: `tests/integration/word-response.test.ts`
- Test: `tests/e2e/word-cloud.spec.ts`

**Langkah.**
1. Batas **1–5 kata** per peserta, panjang max **80 karakter**.
2. Normalisasi **deterministik** + tests: kapital, spasi, Unicode NFC, input kosong, karakter kontrol, ZWJ/ZWNJ.
3. Config: jumlah kiriman per peserta + moderasi sebelum tampil.
4. Agregasi kata di **SQL/server** (bukan client).
5. Visualisasi responsif + **daftar frekuensi tersembunyi/alternatif** untuk screen reader (`aria-live=polite`).
6. Batasi frekuensi animasi (max 2 Hz) agar proyektor tidak tersendat.

**Normalisasi minimal:**
```ts
export function normalize(raw: string): string {
  return raw.normalize('NFC').trim().toLowerCase()
            .replace(/\s+/g, ' ').slice(0, 80);
}
```
Sinonim/merge manual (dosen) datang setelah MVP.

**Acceptance criteria.** Varian kapital/spasi tergabung; konten belum disetujui tidak tampil; **200 respons** tetap lancar pada laptop biasa.

---

## Fase 4a — Padlet Clone: Teks + Moderasi (Rilis v0.3)

**Objective.** Papan kolaborasi kartu **teks** yang bisa dimoderasi.

**Files.**
- Create: `src/lib/components/board/BoardEditor.svelte`
- Create: `src/lib/components/board/BoardView.svelte`
- Create: `src/lib/components/board/PostComposer.svelte`
- Create: `src/routes/api/boards/[boardId]/posts/+server.ts`
- Create: `src/routes/api/boards/posts/[postId]/moderate/+server.ts`
- Test: `tests/integration/board-post.test.ts`
- Test: `tests/e2e/board.spec.ts`

**Langkah.**
1. Layout **columns** (bukan freeform) — lebih baik untuk mobile & aksesibilitas.
2. **Teks-only** dulu (max 500 char, auto-linkify).
3. Moderasi **pending/approved/rejected** — default **pending** kalau moderasi aktif.
4. Reaction opsional: 👍 ❤️ 😂 🤔 (bisa ditunda).
5. Drag/reorder **hanya admin**; sediakan tombol pindah kiri/kanan sebagai alternatif keyboard.
6. Komentar setelah posting inti stabil.

**Acceptance criteria.** Post teks aman terkirim; moderasi real-time; papan tetap nyaman pada 360 px.

---

## Fase 4b — Padlet Clone: Gambar & Tautan (Rilis v0.4)

**Files tambahan.**
- Create: `src/lib/server/uploads.ts`
- Test: `tests/unit/upload-validation.test.ts`

**Langkah.**
1. Tautan: validasi skema **`http`/`https`** saja. **Jangan fetch preview URL** pada MVP (hindari SSRF).
2. Gambar:
   - Validasi MIME **berdasarkan isi file** (magic bytes), bukan hanya extension.
   - Max 5 MB; JPEG/PNG/WebP.
   - **Random filename** server-side.
   - Sajikan dari path `/uploads/…` dengan header `Content-Type` benar + `X-Content-Type-Options: nosniff`.
   - Resize ke max 1600 px pakai `sharp` (opsional, bila kebutuhan terbukti).
3. Ekspor CSV + paket ZIP gambar **hanya bila benar-benar dibutuhkan**.

**Acceptance criteria.** Upload executable yang disamarkan sebagai gambar **ditolak**; gambar terkirim aman; tautan `javascript:` ditolak.

---

## Fase 5 — Crossword (Rilis v0.5)

**Objective.** Dosen membuat TTS **manual**; mahasiswa memainkannya dari ponsel.

**Files.**
- Create: `src/lib/components/crossword/GridEditor.svelte`
- Create: `src/lib/components/crossword/ClueEditor.svelte`
- Create: `src/lib/components/crossword/CrosswordPlayer.svelte`
- Create: `src/lib/server/crossword.ts`
- Test: `tests/unit/crossword-grid.test.ts`
- Test: `tests/unit/crossword-score.test.ts`
- Test: `tests/e2e/crossword.spec.ts`

**Langkah.**
1. Alfabet MVP: **huruf Latin**, angka opsional; normalisasi kapital & spasi.
2. Validator entries: batas grid, overlap **cocok** (huruf yang bersilangan sama), tidak ada entry duplikat, **nomor deterministik**.
3. Editor manual: posisi, arah (across/down), jawaban, petunjuk.
4. Render grid **semantik** (`<table>` atau grid ARIA) dengan navigasi keyboard + perpindahan arah.
5. **Simpan progres otomatis** (throttled ~1 s).
6. **Penilaian server-side**; **jangan** kirim jawaban benar dalam payload awal.
7. Mode latihan: cek huruf, cek kata, atau cek saat submit (konfigurable).
8. Generator grid **otomatis ditunda** sampai data pemakaian membuktikan kebutuhan.

**Payload aman.** Klien hanya menerima:
```json
{
  "gridShape": [[1,1,0,1],[1,0,0,1],...],
  "entries": [{"number":1,"row":0,"col":0,"direction":"across","length":4,"clue":"..."}],
  "numbers": [[1,0,0,2],...]
}
```
Jawaban tidak dikirim. Cek dilakukan via `POST /api/crosswords/:id/check` dengan payload huruf isian → server balas mask benar/salah.

**Acceptance criteria.** Overlap divalidasi; jawaban tidak terlihat dari HTML/JSON awal; refresh memulihkan progres; navigasi keyboard berfungsi.

---

## Fase 6 — Hardening & Deployment (Rilis v1.0)

**Objective.** Platform aman, dapat dipulihkan, dan layak dipakai di kelas.

**Files.**
- Create: `.env.example`
- Create: `Dockerfile`
- Create: `docs/deployment.md`
- Create: `docs/backup-restore.md`
- Test: `tests/e2e/session-lifecycle.spec.ts`

**Langkah.**
1. Validasi seluruh input di server dengan **Zod**.
2. **CSRF protection** untuk mutasi berbasis cookie + cek origin.
3. Header keamanan: **CSP**, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`.
4. Sanitasi output; **hindari `{@html}`** untuk konten pengguna.
5. Retensi hasil (default **180 hari**) + tombol hapus data sesi dengan konfirmasi.
6. Backup terjadwal + **uji restore** ke direktori sementara.
7. Docker image **non-root** + volume persisten untuk DB & upload.
8. `lint + typecheck + unit + integration + e2e + build + audit dependency`.
9. **Load test** realistis untuk 100 peserta pada poll/word cloud.
10. Deploy **staging** → smoke test dari ponsel di Wi-Fi & seluler.

**Acceptance criteria.** Semua test lulus; restore backup terbukti; data tetap ada setelah restart container; 100 peserta simulasi tanpa error atau kehilangan respons.

---

## Strategi Testing

### Unit
- Generator kode sesi
- Normalisasi kata
- Validator crossword + perhitungan skor
- Validasi upload & URL
- State transition sesi

### Integration
- Login/logout + cookie
- Join/rejoin sesi
- Constraint satu respons per peserta
- Moderasi post
- Tutup sesi menolak respons baru
- Ekspor CSV aman terhadap formula injection

### E2E (Playwright)
3 context: **admin, mahasiswa A, mahasiswa B**.

Skenario wajib:
1. Admin membuat aktivitas & membuka sesi.
2. Dua mahasiswa join dengan kode.
3. Keduanya mengirim respons.
4. Presenter menerima update live.
5. Admin menutup aktivitas.
6. Respons baru ditolak dengan pesan jelas.
7. Refresh/reconnect memulihkan state.

---

## Wireframe teks — Presenter (proyektor)

```
┌────────────────────────────────────────────────────────────┐
│  EDU NARA · Ruang: A B 3 C 7 K       ●  87 peserta         │
│                                                            │
│  Apa framework terbaik?                                    │
│                                                            │
│   Svelte  ████████████████████████████████  62 %          │
│   React   ██████████████               28 %                │
│   Vue     ████    7 %                                      │
│   Solid   ██  3 %                                          │
│                                                            │
│                                        [QR]                │
└────────────────────────────────────────────────────────────┘
```

Kontrol admin ada di **layar terpisah** (control panel), tidak menutup proyektor.
