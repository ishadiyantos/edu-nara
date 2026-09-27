# Riwayat Pengembangan & Rilis

Catatan ringkas tiap fase: fitur yang dibangun → push GitHub → deploy production Pi 5.
Bukti historis bukan verifikasi runtime saat ini. Untuk rilis berikutnya catat
fitur, commit SHA, SHA remote, release Pi 5, health, alur live, dan blocker.
Test stabilitas luas ditempatkan pada tahap akhir (PLANNING.md §13).

## Target production

- Pi: `ishanaracho@10.200.10.5`, hostname `nara-raspberrypi`, arsitektur `aarch64`.
- Path: `/DATA/AppData/edu-nara` (local NVMe; bukan NFS/SMB).
- Struktur: `private/.env` (mode 600, secret), `data/` (UID 1000, SQLite WAL),
  `releases/<id>/` (source immutable), `current` (symlink dipromosikan setelah healthy).
- Akun admin pakai email pengguna; password awal acak, privat, bukan commit Git.
- Jangan sentuh tunnel, Home Assistant, atau layanan lain.

## Fase 1 — Fondasi (v0.1a; riwayat, bukan rerun)

- Fitur: login admin, aktivitas/sesi, guest join/rejoin, SSE live, health check.
- Production: `edu-nara-app-1` healthy di `10.200.10.5:3000`; `/health` `{"ok":true}`;
  `/admin` anonim `303`, `/admin/login` `200`.

## Fase 1.5 — Redesign visual & landing satu layar

- Fitur: arah visual "Playful Academic Studio", landing satu layar non-scroll,
  dashboard berbasis data nyata, waiting room layout ulang.
- Release: `20260926T221302Z-8998`; container healthy.
- Live marker: HTML memuat `join-shell` + `Masuk ke kelasmu`; CSS fingerprinted.

## Fase 2 — Multiple Choice MVP (v0.1; catatan historis)

- Fitur: editor pertanyaan+opsi (2–8, non-duplikat), player mahasiswa (satu opsi, submit
  idempotent), tally presenter agregat, hasil mahasiswa tertutup sampai admin membukanya.
- Migration: `0002_multiple_choice.sql`.
- Production build & deploy release-based lulus di Pi 5 ARM64.

## Snapshot audit (2026-09-27; bukan status live terkini)

Saat audit, working tree memuat implementasi Fase 1 + Multiple Choice; masih ada gap kontrak, CSV, dan persistence yang dicatat di LOCAL-PHASE1-MULTIPLE-CHOICE-AUDIT.md. Runtime production belum
terverifikasi sehat saat audit tersebut (compose ps kosong, curl loopback health gagal konek). Hasil itu sendiri belum membuktikan layanan pada alamat bind LAN mati.
Diperlukan task operasional: cek container release aktif, pulihkan bila perlu, verifikasi health.