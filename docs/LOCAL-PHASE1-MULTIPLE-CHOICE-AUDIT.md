# Status Pengembangan — Fase 1 & Multiple Choice

Snapshot audit 2026-09-27, bukan pemeriksaan runtime terbaru. Fokus pengembangan:
fitur end-to-end, push GitHub, deploy production Pi 5, stabilitas luas di akhir.
Temuan historis perlu dicek kembali sebelum menjadi dasar tindakan production.

## Sudah dibangun

- Fase 1 lengkap: DB/auth admin, aktivitas/sesi, guest join/rejoin, generator kode sesi,
  endpoint SSE, health check.
- Multiple Choice: editor, player, respons idempotent per peserta-pertanyaan, tally agregat,
  hasil tersembunyi sampai admin membukanya.

## Hal yang perlu diputuskan / diselesaikan (fitur)

1. **P0 — pulihkan/verifikasi production Pi 5.** Cek container/compose release aktif dan
   health endpoint; pulihkan service bila down lewat task operasional berwenang. Jangan deploy
   dari dokumen ini.
2. **P1 — kunci kontrak Multiple Choice.** Saat ini menerima multi-opsi & multi-benar
   (`optionIds`, `correctOptions`), beda dari spec awal satu opsi. Pilih satu — single-select
   atau multi-select — lalu samakan validasi, schema, UI.
3. **P1 — implementasikan ekspor CSV hasil.** Belum ditemukan pada snapshot source saat audit; wajib proteksi formula injection.
4. **P1 — pulihkan pilihan/progres saat refresh.** Simpan dan muat state dari server; jangan mengandalkan memori komponen.
5. **P1 — jaga privasi hasil sebelum production.** Cek terarah bahwa hasil tertutup
   dan answer key tidak bocor lewat HTML/JSON/SSE; admin dapat membuka hasil.
   Cek keamanan ini tidak menunggu tahap stabilitas akhir.

Setelah hal di atas selesai: push `origin/main`, deploy `./scripts/deploy.sh`, verifikasi health.
Test stabilitas penuh menunggu gate rilis (PLANNING.md §13).