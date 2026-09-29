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

## Tampilan papan diskusi

- Kanvas hijau gelap penuh pada presenter; judul Board utama, kode sesi ringkas.
- Kolom fleksibel mengisi lebar desktop. Header judul panjang sejajar memakai CSS subgrid;
  mobile tetap dapat digeser horizontal, isi tiap kolom bergulir vertikal.
- Kartu putih dengan author/timestamp di atas; drag handle tidak membuat baris kosong.
- Tombol `⋯` membuka modal edit judul, dengan textarea 120 karakter, Batal/Simpan.
  Tambah kolom juga melalui modal. Modal tetap tersedia saat presentasi.
- Pencarian/slideshow/share tetap di toolbar kanan atas; Posting mahasiswa mengambang
  di kanan bawah. Tidak menambahkan komentar, reaksi, atau wallpaper eksternal.

Status deploy/verifikasi production dicatat operator rilis; catatan ini bukan bukti deploy.
