# Edu Nara — Spesifikasi Fase & Fitur

> Acuan fitur aktif. Utamakan source code end-to-end, push GitHub, lalu deploy production Pi 5 per fitur. Test stabilitas luas hanya pada tahap akhir; lihat `PLANNING.md` §12–13. Keamanan dan perlindungan data tetap dibangun bersama fitur.

---

## Fase 0 — Validasi Konsep UI

**Objective.** Membuktikan navigasi dan identitas visual sebelum membuat backend.

**Files.**
- Create: `src/routes/+page.svelte`
- Create: `src/routes/join/+page.svelte`
- Create: `src/routes/admin/+layout.svelte`
- Create: `src/app.css`

**Langkah.**
1. Tetapkan nama sementara, warna utama, font lokal/system, radius, shadow, spacing, dan state komponen.
2. Buat wireframe: landing, join, dashboard, presenter, dan 4 layar aktivitas.
3. Validasi alur join singkat dengan pengguna; rapikan hambatan yang nyata.

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
- Heartbeat server setiap 20 s; browser tidak mengirim ACK. Cleanup ketika request abort, otorisasi kedaluwarsa, atau antrean klien lambat penuh. Reconnect memakai replay/resync.

**Acceptance criteria.** Admin login; activity kosong dapat dibuat; sesi menghasilkan kode; dua browser dapat join; reconnect **tidak** menggandakan peserta.

---

## Fase 2 — Multiple Choice (Rilis v0.1)

**Objective.** Aktivitas paling sederhana selesai end-to-end dan menjadi **pola** fitur berikutnya.

**Files.**
- Implementasikan komponen editor, player, presenter dan endpoint submit pada struktur proyek saat ini.
- Migration untuk pertanyaan, opsi, respons, dan constraint satu respons per peserta/pertanyaan.

**Langkah.**
1. Editor pertanyaan + opsi dengan **preview ponsel** di kanan.
2. Endpoint submit idempotent (`Idempotency-Key` atau constraint peserta + pertanyaan).
3. SSE broadcast aggregate count, bukan data peserta.
4. Presenter results: bar chart CSS/SVG tanpa chart framework.
5. Kontrol tampil/sembunyikan hasil + buka/tutup voting.
6. Ekspor CSV UTF-8 dengan proteksi formula injection.

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

**Acceptance criteria.** Alur admin buat pertanyaan → mahasiswa pilih → tally presenter tampil, berjalan di aplikasi nyata. Refresh mempertahankan pilihan; hasil **tidak bocor** sebelum admin membukanya. Load/stress masuk gate rilis akhir, bukan per fitur.

---

## Fase 3 — Word Cloud (Rilis v0.2)

**Objective.** Mahasiswa mengirim kata/frasa; presenter melihat agregasi live.

**Files.** Implementasikan komponen Word Cloud editor/player/results dan logika normalisasi pada struktur proyek saat ini.

**Langkah.**
1. Batas 1–5 kata per peserta, panjang max 80 karakter.
2. Normalisasi deterministik (kapital, spasi, Unicode NFC, input kosong, karakter kontrol).
3. Config: jumlah kiriman per peserta + moderasi sebelum tampil.
4. Agregasi kata di SQL/server (bukan client).
5. Visualisasi responsif + daftar frekuensi alternatif untuk screen reader (`aria-live=polite`).
6. Batasi frekuensi animasi (max 2 Hz) agar proyektor tidak tersendat.

**Normalisasi minimal:**
```ts
export function normalize(raw: string): string {
  return raw.normalize('NFC').trim().toLowerCase()
            .replace(/\s+/g, ' ').slice(0, 80);
}
```
Sinonim/merge manual (dosen) datang setelah MVP.

**Acceptance criteria.** Editor, kiriman mahasiswa, moderasi, dan agregasi presenter berjalan; varian kapital/spasi tergabung; konten belum disetujui tidak tampil. Target 200 respons diperiksa pada tahap stabilitas akhir.

---

## Fase 4a — Padlet Clone: Teks + Moderasi (Rilis v0.3)

**Objective.** Papan kolaborasi kartu **teks** yang bisa dimoderasi.

**Files.**
- Create: `src/lib/components/board/BoardEditor.svelte`
- Create: `src/lib/components/board/BoardView.svelte`
- Create: `src/lib/components/board/PostComposer.svelte`
- Create: `src/routes/api/boards/[boardId]/posts/+server.ts`
- Create: `src/routes/api/boards/posts/[postId]/moderate/+server.ts`

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

## Fase 6 — Stabilitas Akhir (Rilis v1.0)

**Objective.** Validasi stabilitas platform setelah semua fitur MVP terdeploy. Keamanan dasar, Docker, dan perlindungan data bukan pekerjaan yang ditunda ke fase ini.

**Files.**
- Create: `.env.example`
- Create: `Dockerfile`
- Update: `docs/DEPLOY.md`; gunakan panduan deploy/backup yang ada, jangan membuat dokumen duplikat.

**Langkah.**
1. Validasi seluruh input di server dengan **Zod**.
2. **CSRF protection** untuk mutasi berbasis cookie + cek origin.
3. Header keamanan: **CSP**, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`.
4. Sanitasi output; **hindari `{@html}`** untuk konten pengguna.
5. Retensi hasil (default **180 hari**) + tombol hapus data sesi dengan konfirmasi.
6. Backup terjadwal + **uji restore** ke direktori sementara.
7. Docker image **non-root** + volume persisten untuk DB & upload.
8. **Setelah semua fitur terdeploy**: baru jalankan suite penuh — `lint + typecheck + unit + integration + e2e + build + audit dependency`, dan load test 100 peserta bila target kapasitas dipakai. Ini gate rilis v1.0, bukan langkah per fitur.

**Acceptance criteria.** Fitur terdeploy dan sehat di production; pada gate rilis akhir: suite penuh lulus, restore backup terbukti, data tetap ada setelah restart container.

---

## Strategi Delivery (lihat PLANNING.md §13)

- Urutan tiap fitur: source code end-to-end → check murah seperlunya → push GitHub → deploy production Pi 5 → verifikasi health. Test stabilitas lengkap hanya di akhir, sebelum rilis stabil v1.0, bukan setiap tag v0.x.
- Jangan menulis test dulu untuk fitur yang masih berubah bentuk; test menyusul setelah alur stabil.
- Unit test hanya untuk logika murni rawan bug: normalisasi kata, skor, generator kode sesi.
- Integration test hanya untuk kontrak penting: idempotency, isolasi sesi, akses lintas aktivitas.

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
