# Catatan rilis — Board core 4a + 4b

- Editor Board production: buat/rename/geser kolom, hapus hanya kolom kosong.
- Mahasiswa: kartu judul/teks/gambar/link, kiriman sendiri dengan status moderasi.
- Dosen: toggle moderasi aktif/nonaktif persisten, moderasi, drag/drop kartu lintas kolom,
  edit judul kolom, dan tambah kolom dari panel presentasi.
  Toggle nonaktif hanya auto-approve kiriman baru, bukan antrean lama.
- Papan kolom horizontal dengan kartu putih, judul board, pencarian, share, slideshow semua
  kartu approved, fullscreen; SSE invalidation dan snapshot refresh, tanpa konten privat di replay.
- Upload JPEG/PNG/WebP ≤5 MiB, signature validation, UUID filename, gambar scoped;
  link http/https tanpa preview fetch. API retry UI idempotent.
- Migration additive `0010_board_media`; volume `/app/data/uploads` wajib ikut backup.
  File orphan akibat retensi masih perlu cleanup terpisah. Komentar/reaksi ditunda.

Status deploy/verifikasi production dicatat operator rilis; catatan ini bukan bukti deploy.
