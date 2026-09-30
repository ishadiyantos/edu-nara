# Board core — Fase 4a + 4b

## Alur production

Dashboard **Board → Buka editor** membuka `/admin/activities/[id]/board`.
Dosen membuat, mengganti nama, menggeser kiri/kanan, dan menghapus kolom kosong.
Batas 20 kolom; nama 1–120 karakter. Hapus ditolak bila kolom memiliki kartu
pada sesi mana pun, termasuk kartu ditolak/disembunyikan. Sesi diluncurkan
ke presenter standar `/admin/sessions/[id]`; mahasiswa memakai `/play/[sessionCode]`.

Papan memakai kolom horizontal: nama, waktu WIB, judul opsional, teks, gambar,
tautan. Pencarian mencakup nama, judul, isi, tautan. Slideshow hanya memuat kartu
disetujui dan memakai tombol sebelumnya/berikutnya atau panah keyboard. Fullscreen
presenter memakai kontrol sesi yang sudah ada; kartu panjang tetap dapat digulir.
Reaksi/komentar tidak ada. **Composer** dibuka sebagai modal; pilih kolom tujuan
sebelum kirim. Kartu baru dapat memakai warna pastel ringan (krem, merah muda,
kuning, mint, biru langit, atau ungu muda) dengan teks tetap gelap dan terbaca.
Preview tautan aman menampilkan judul dan thumbnail lokal bila metadata tersedia.
URL tetap tampil sebagai fallback bila fetch gagal.

## Moderasi dan akses

- Moderasi tersimpan **per aktivitas Board**, default aktif; bisa diubah melalui
  editor maupun panel sesi dosen. Pengaturan berlaku pada seluruh sesi papan.
- Aktif: kiriman baru `pending`. Nonaktif: kiriman baru `approved`.
- **Menonaktifkan moderasi tidak mengubah antrean lama.** Persetujuan tetap eksplisit.
- Dosen pemilik melihat semua kartu, menyetujui, menolak, menyembunyikan dan
  mengurutkan kartu dalam kolom. Tombol naik/turun menyimpan urutan lengkap;
  urutan basi/duplikat/lintas kolom ditolak, tanpa sukses optimistis.
- Peserta hanya melihat kartu `approved` bersama dan seluruh status kartu sendiri.
  Pending, rejected, hidden milik orang lain tidak masuk SSR, API, gambar atau SSE.
- Semua route baca production memerlukan cookie admin pemilik atau peserta sesi
  yang belum kedaluwarsa. Tidak ada papan/gambar anonim.
- Session closed/draft/ended menolak kartu baru; papan tetap bisa dibaca.

## Kontrak API

- `GET /api/boards/[sessionCode]/posts`: `{ok, columns, posts, moderationEnabled, state}`.
  - Post berisi `id,columnId,author,title,body,linkUrl,imageUrl,previewTitle,previewImageUrl,cardColor,status,position,createdAt`;
  tidak mengirim token/hash peserta, request ID, atau path filesystem.
- `POST /api/boards/[sessionCode]/posts`: JSON teks atau multipart dengan
  `columnId,body,title?,linkUrl?,requestId?` dan file opsional `image`.
  UI selalu mengirim requestId acak; unique `(session_id,participant_id,request_id)`
  membuat retry idempotent. API lama tanpa requestId tetap didukung.
  Respons `{ok,postId,status,position,lastEventId}`. Retry setelah respons hilang
  mengembalikan kartu yang sama, bahkan setelah sesi ditutup.
- `POST /api/boards/posts/[postId]/moderate`: `{status}` dengan
  `pending|approved|rejected|hidden`; alias action `approve|reject|hide` diterima.
- `POST /api/boards/[sessionCode]/columns/[columnId]/order`: `{ids:[...]}`.
  Harus seluruh ID kolom sesi tersebut, tanpa duplikat; hanya pemilik.
- `POST /api/boards/[sessionCode]/settings`: `{moderationEnabled:boolean}`; pemilik.
- `GET /api/boards/images/[imageId]`: gambar terautentikasi, scoped ke sesi/post.
  Pending/rejected/hidden hanya admin pemilik atau penulis, approved seluruh peserta
  sesi valid. Akses tidak sah 404. `private,no-store`, `nosniff`, CSP sandbox,
  `Cross-Origin-Resource-Policy: same-origin`.

Teks maksimal **500 code point Unicode**, newline/tab diterima; karakter kontrol
lain ditolak. Judul opsional maksimal 120; minimal satu dari teks/judul/link/gambar.
- Tautan maksimal 2048, URL absolut http/https saja, tanpa kredensial atau whitespace.
- Preview server-side hanya mengambil URL publik melalui koneksi IPv4 yang dipin setelah DNS, memblokir jaringan privat, memvalidasi setiap redirect, tanpa cookie/kredensial, dengan timeout dan batas ukuran. Metadata di-escape oleh Svelte; thumbnail disimpan sebagai media Board terotorisasi.
- Rendering memakai escaping Svelte;
linkify menghasilkan elemen `<a>`, bukan HTML mentah.

## Media dan penyimpanan

JPEG/PNG/WebP hingga **5 MiB**, diperiksa signature isi file oleh validator media
yang sudah ada, bukan nama/Content-Type klien. SVG, executable biasa, file kosong,
format lain, dan file oversized ditolak. Validator signature bukan decoder penuh
atau antivirus; tidak ada resize/re-encode. Browser menerima MIME raster tetap,
bukan extension klien. Nama file UUID server; tidak ada file di direktori static.

Multipart dibatasi saat streaming sebelum parsing: 5 MiB + 64 KiB overhead.
Adapter node/Docker Compose memakai `BODY_SIZE_LIMIT=6M`; batas HTTP JSON tetap
4 KiB. Upload root `UPLOAD_DIR`, default `uploads` di samping `DATABASE_PATH`.
Production Compose: `/app/data/uploads`, volume data persisten yang sama.
File baru dibersihkan bila validasi/penyimpanan DB gagal atau retry sudah tersimpan.

Migration **0010_board_media** dan **0011_board_link_preview** hanya menambah
`activities.board_moderation`, `board_posts.title/link_url/image_id/request_id`,
`board_posts.preview_title/preview_image_id/card_color`, serta unique index.
Tidak ada reset, rewrite tabel, atau penghapusan data lama.

**Operasional:** backup SQLite saja tidak mencakup gambar. Backup/restore harus
menyertakan direktori upload dengan konsistensi snapshot DB (hentikan kiriman
sementara bila perlu). Maintenance retensi lama menghapus row kartu, bukan file
upload; orphan setelah retensi/crash dapat tertinggal dan perlu audit pembersihan
terpisah. Tidak menambahkan cleanup luas dalam fase ini.

## Realtime dan pemulihan

`board.post.new`, `board.post.moderated`, `board.post.removed`, `board.reordered`
membawa **payload kosong** sebagai invalidation. Buffer replay tidak pernah memuat
isi, nama, link, media ID atau status privat. Klien mengambil ulang snapshot API
terotorisasi ketika event, connect/reconnect, snapshot/resync; fallback 15 detik.
Perubahan kolom/setting mengirim invalidation ke seluruh sesi aktivitas.
Student memakai satu SSE; presenter memakai SSE sesi yang sudah ada.

## Gate terarah

Regression `tests/integration/board-post.test.ts` mencakup default pending,
Unicode, persistensi order, pemilik, toggle on/off tanpa persetujuan antrean lama,
idempotency, media scoped sebelum/sesudah moderasi, token expiry.
`tests/e2e/board-live.spec.ts` satu alur production dengan gambar/link, dua peserta,
moderasi realtime, auto-approve, refresh, pencarian, slideshow/fullscreen dan 360 px.
Gunakan runner isolated DB; build/deploy/gate production milik release operator.
