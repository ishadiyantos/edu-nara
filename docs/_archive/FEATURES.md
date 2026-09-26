# edu-nara — Spesifikasi Fitur Detail

Spec per-fitur untuk 3 aktivitas MVP. Setiap fitur berdiri sendiri sebagai modul.

---

## Fitur A — Padlet Clone ("Board")

### User story
- **Dosen**: "Saya ingin mahasiswa menempel ide/jawaban di board bersama, live."
- **Mahasiswa**: "Saya buka link/scan QR, isi nama, tempel catatan warna-warni, lihat catatan teman muncul real-time."

### Mode board
1. **Grid** — kolom-kolom bertema (misal: "Pro", "Kontra", "Pertanyaan")
2. **Wall** — freeform, mahasiswa drag posisi (opsional M1.5)
3. **Stream** — kronologis, mirip feed

### Fitur post
- Teks (max 500 char, auto-link URL)
- Warna sticky (8 preset)
- Emoji picker
- Upload 1 gambar (max 5 MB, auto-resize)
- Reaction: 👍 ❤️ 😂 🤔 (mahasiswa boleh multi)
- Edit/hapus post sendiri (dalam 5 menit)

### Fitur dosen
- Moderasi: approve-first (opsional), pin, hapus, sembunyikan
- Export: PNG (board snapshot) + CSV (semua post)
- Reset board / duplicate board

### Realtime events
- `post.new`, `post.update`, `post.delete`
- `reaction.toggle`
- `board.config.change` (dosen ganti mode)

### Data
```sql
padlet_boards(id, activity_id, mode, columns_json, allow_reactions, moderation)
padlet_posts(id, board_id, participant_id, column_key, text, color, emoji,
             image_url, position_x, position_y, created_at, edited_at, hidden)
padlet_reactions(id, post_id, participant_id, kind)
```

---

## Fitur B — Word Cloud & Poll Multiple Choice ("Live Response")

### B1. Word Cloud

**User flow**
1. Dosen buat aktivitas: pertanyaan + jumlah kata per orang (default 3) + filter kata jorok on/off.
2. Mahasiswa lihat pertanyaan → input kata satu per satu → tekan enter.
3. Kata muncul di cloud dosen dengan animasi grow; kata yang sudah ada → ukuran +1 bobot.
4. Dosen bisa "Freeze" cloud lalu "Reveal" saat presentasi.

**Detail teknis**
- Normalisasi: lowercase, trim, strip diakritik, gabungkan sinonim manual (dosen bisa merge 2 kata).
- Filter: daftar stopword ID+EN + regex kata kasar (bisa di-off).
- Rendering: SVG custom (bukan library berat), spiral layout Archimedean.
- Update strategi: debounce broadcast 300ms saat banyak submit bersamaan.

**Data**
```sql
wordcloud_configs(id, activity_id, question, max_words_per_user, filter_profanity, frozen)
wordcloud_entries(id, activity_id, participant_id, word_raw, word_normalized, created_at)
wordcloud_merges(id, activity_id, from_word, to_word)  -- manual merge dosen
```

### B2. Poll Multiple Choice

**User flow**
1. Dosen buat: pertanyaan + 2–8 opsi + single/multi choice + tampilkan hasil live? (y/n).
2. Mahasiswa: tap opsi → submit → lihat "Terima kasih" (atau bar chart kalau live).
3. Dosen: bar chart animatif, angka + persentase, tombol "Correct answer" (untuk mode kuis singkat).

**Detail teknis**
- Cegah double vote: unique (option_id/question_id, participant_id).
- Chart: SVG bar, animasi width transition dengan Motion One.
- Mode "race": bar bergerak real-time saat vote masuk.

**Data**
```sql
poll_questions(id, activity_id, text, multi_select, show_live_result, correct_option_ids_json)
poll_options(id, question_id, label, order_index)
poll_votes(id, option_id, participant_id, created_at)
```

**Shared events**
- `wc.entry.new`, `wc.snapshot`, `wc.freeze`
- `poll.vote`, `poll.tally`

---

## Fitur C — Teka-Teki Silang ala Wordwall ("Crossword")

### User story
- **Dosen**: "Saya input 10–20 pasang kata+clue, sistem generate grid otomatis, mahasiswa main di HP."
- **Mahasiswa**: "Saya isi grid, keyboard on-screen adaptif, auto-check kalau benar berubah hijau."

### Editor dosen
1. Input daftar `{word, clue, direction_preference?}`
2. Tombol **Generate** → algoritma layout (lihat di bawah)
3. Preview grid, drag manual jika mau geser
4. Set: timer on/off, jumlah nyawa (hint), skor per kata, tampilkan leaderboard live

### Algoritma generator (server-side)
1. Sort kata descending by length.
2. Kata pertama letakkan horizontal di tengah.
3. Untuk kata berikutnya: cari huruf overlap dengan kata yang sudah terpasang; letakkan tegak lurus, validasi tidak konflik.
4. Kalau gagal semua overlap → letakkan di area kosong terdekat.
5. Return grid matrix + list `{number, direction, row, col, word, clue}`.

Library referensi: implementasi sendiri (~200 baris TS) atau adaptasi `crossword-layout-generator` npm.

### Runtime mahasiswa
- Grid responsive; cell aktif highlight, kata aktif highlight lembut.
- Tap cell → keyboard muncul (native mobile keyboard, input hidden).
- Panah kiri/kanan/atas/bawah pindah cell.
- Auto-advance ke cell berikutnya saat huruf terisi.
- Tombol: `Check`, `Reveal letter` (kurangi skor), `Reveal word`.
- Selesai → skor + waktu → submit ke leaderboard.

### Leaderboard (opsional live)
- Top 10 dosen lihat di layar; update via WS `crossword.progress`.

### Data
```sql
crossword_puzzles(id, activity_id, grid_json, words_json, timer_seconds,
                  score_per_word, allow_hints, show_leaderboard)
crossword_progress(id, puzzle_id, participant_id, filled_json,
                   hints_used, completed_at, score, duration_seconds)
```

---

## Cross-cutting: Pola Umum Semua Aktivitas

### Lifecycle
```
draft → live → closed → archived
```
- `draft`: hanya dosen lihat (edit bebas)
- `live`: mahasiswa bisa submit
- `closed`: read-only, hasil masih tampil
- `archived`: sembunyikan dari dashboard

### Mode Presentasi (F key)
- Fullscreen, hilangkan chrome
- QR code kode room di pojok
- Counter "N mahasiswa terhubung"
- Tombol Next/Prev antar aktivitas (jika room punya banyak)

### Accessibility
- Kontras WCAG AA
- Semua interaksi keyboard-accessible
- `aria-live` untuk update realtime penting
- Font size min 16px di mobile

### i18n
- Default: Bahasa Indonesia
- String di `src/lib/i18n/id.json` (siap tambah `en.json`)
