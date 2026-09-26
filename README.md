# Edu Nara

Platform aktivitas interaktif untuk kelas mahasiswa. Solo-dev, self-host, mobile-first.

Mahasiswa join lewat **kode sesi + nama tampilan** (tanpa akun), mirip Mentimeter. Admin/dosen login untuk membuat aktivitas, membuka sesi, moderasi, dan ekspor hasil.

## Fitur MVP

1. **Multiple Choice** — polling langsung dengan hasil live (rilis v0.1)
2. **Word Cloud** — agregasi kata dari peserta (rilis v0.2)
3. **Padlet Clone** — papan kartu kolaboratif dengan moderasi (rilis v0.3–v0.4)
4. **Crossword** — teka-teki silang ala Wordwall, editor manual + player mobile (rilis v0.5)

## Stack

SvelteKit + TypeScript · SQLite + Drizzle ORM · Tailwind CSS · Zod · SSE · Vitest + Playwright

## Dokumentasi

Semua keputusan produk, arsitektur, dan roadmap ada di:

- **[docs/PLANNING.md](docs/PLANNING.md)** — sumber kebenaran keputusan, arsitektur, data model, protokol SSE
- **[docs/FEATURES.md](docs/FEATURES.md)** — spesifikasi fase 0–6 dengan wireframe & acceptance criteria
- **[docs/PROMPT.md](docs/PROMPT.md)** — master prompt & kickoff per fase untuk AI coding assistant

## Status

📋 Fase planning selesai. Belum mulai implementasi.

Roadmap: Fase 0 (validasi UI) → Fase 1 (fondasi) → Fase 2 (MC, v0.1) → … → Fase 6 (v1.0).

## Lisensi

Untuk pemakaian pribadi. Lisensi menyusul.
