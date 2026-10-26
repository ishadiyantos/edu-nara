# Edu Nara API dan integrasi AI lokal

Status diperiksa dari route source repository pada 2026-10-27. Dokumen ini membedakan API yang benar-benar ada dari API authoring yang belum tersedia.

## Ringkasan

Edu Nara sudah memiliki HTTP API untuk beberapa operasi **dalam sesi yang sudah ada**. Contoh: membaca/mengirim card Board, membuat column Board pada activity/session yang sudah diluncurkan, join peserta, Crossword progress/check, poll responses, dan live events.

Namun, repo **belum menyediakan API publik/terdokumentasi untuk membuat activity library baru** (misalnya `POST /api/activities`), membuat template activity, mengelola crossword clue lewat API, atau membuat lalu meluncurkan session sebagai alur authoring tunggal. Dashboard admin membuat activity lewat SvelteKit form action `?/create`; itu bukan kontrak API stabil untuk AI lokal.

Kesimpulan praktis:

- **AI lokal dapat membantu sekarang:** menyusun konten; memakai UI admin yang sudah login; dan menggunakan API runtime tertentu setelah activity/session dibuat.
- **AI lokal belum punya jalur server API yang stabil untuk membuat seluruh activity dari nol.** Jangan menganggap endpoint operasional per session sebagai authoring API.
- Untuk integrasi yang aman/andal, tambahkan authenticated Admin Authoring API; jangan memberi AI akses langsung ke SQLite production.

## Endpoint yang terverifikasi

Semua endpoint berada pada base URL deployment. Contoh production base URL: `https://edu.ishaalim.dev`. Hanya gunakan host yang dikonfirmasi pemilik sistem.

| Method | Path | Fungsi | Auth/catatan |
|---|---|---|---|
| `POST` | `/api/join` | Join session dengan code + display name; app menetapkan participant cookie | Publik, dibatasi join/session policy |
| `GET` | `/api/boards/{sessionCode}/posts` | Baca snapshot Board sesuai akses/column peserta | Admin session atau participant cookie |
| `POST` | `/api/boards/{sessionCode}/posts` | Buat card teks/link/gambar dalam session Board yang open | Participant cookie; validasi session, column, rate limit, ukuran/media |
| `POST` | `/api/boards/{sessionCode}/columns` | Tambah Board column untuk activity pemilik yang sudah terkait dengan session | Admin login; body JSON `{ "title": "..." }` |
| `POST` | `/api/boards/{sessionCode}/columns/{columnId}` | Rename column terkait activity pemilik session | Admin login; body JSON `{ "title": "..." }` |
| `POST` | `/api/boards/{sessionCode}/settings` | Ubah Board moderation | Admin login; body `{ "moderationEnabled": true }` |
| `POST` | `/api/boards/posts/{postId}/moderate` | Moderate card | Admin login; action/status tervalidasi |
| `POST` | `/api/boards/{sessionCode}/posts/{postId}/comments` | Tambah komentar | Participant cookie dan aturan visibilitas card |
| `POST` | `/api/boards/{sessionCode}/posts/{postId}/reaction` | Toggle reaction | Participant cookie |
| `POST` | `/api/boards/{sessionCode}/posts/{postId}/move` | Pindah card ke column/posisi lain | Admin login; body `{ "columnId": "...", "position": 0 }` |
| `POST` | `/api/boards/{sessionCode}/columns/{columnId}/order` | Atur urutan card dalam column | Admin login; body `{ "ids": ["..."] }` |
| `GET` | `/api/boards/images/{imageId}` | Baca gambar card terotorisasi | Admin/participant yang punya akses ke card/session |
| `GET` | `/api/sessions/{sessionId}/events` | SSE live updates | Admin session atau participant cookie |
| `GET` | `/api/crosswords/{sessionCode}/progress` | Baca progress milik peserta | Participant cookie valid dan belum expired |
| `POST` | `/api/crosswords/{sessionCode}/progress` | Autosave crossword cells | Participant cookie; session harus open; jawaban tetap server-side |
| `POST` | `/api/crosswords/{sessionCode}/check` | Cek cells dan hitung score | Participant cookie; session harus open; response berisi hasil per-cell, bukan answer key |
| `POST` | `/api/polls/{sessionCode}/responses` | Submit quiz choice | Participant cookie; session/question tervalidasi |
| `POST` | `/api/wordcloud/{sessionCode}/responses` | Submit wordcloud response | Participant cookie |

Path inventory lengkap dan schema harus diperiksa di `src/routes/api/` dan route handler terkait sebelum membangun integrasi. Endpoint UI/internal lain dapat berubah tanpa pemberitahuan.

## Contoh: tambah column ke Board yang sudah punya session

Syarat: Admin sudah login di browser, ada live session yang menunjuk ke Board activity, dan request dilakukan dari origin yang sama supaya cookie/CSRF policy browser berlaku. `{sessionCode}` harus kode session itu, bukan activity ID.

```http
POST /api/boards/ABC123/columns
Content-Type: application/json

{"title":"Stakeholder dan Kebutuhan"}
```

Route source: `src/routes/api/boards/[sessionCode]/columns/+server.ts`.

Contoh `curl` hanya sesuai jika cookie admin diperoleh dari login aman di lingkungan pemilik, disimpan lokal dengan permission ketat, dan tidak dikirim ke chat/log. Jangan meminta dosen menempel cookie ke prompt. Untuk web browser, gunakan same-origin `fetch` saat sesi admin aktif:

```js
const response = await fetch('/api/boards/ABC123/columns', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ title: 'Stakeholder dan Kebutuhan' })
});
const result = await response.json();
if (!response.ok || !result.ok) throw new Error(result.message ?? 'Column creation failed');
```

API ini hanya menambah column pada **activity yang didapat dari session**. API ini tidak membuat Board/activity library baru dan bukan pengganti alur admin authoring.

## Jalur AI lokal yang dapat dipakai sekarang

### Pilihan A — browser dengan login pemilik

1. Pemilik login di Edu Nara melalui browser.
2. AI menyiapkan title, column, clue/pertanyaan, dan instruksi terlebih dahulu.
3. AI mengisi UI admin via browser automation yang disetujui pemilik.
4. AI membaca balik hasil dan melaporkan URL/ID.
5. AI tidak menekan Launch/Open kecuali diminta.

Ini bisa menghindari copy-paste manual, tetapi masih mengandalkan UI. Perubahan markup/flow bisa mematahkan automasi; bukan API contract.

### Pilihan B — sesi aplikasi lokal dan API runtime

AI lokal dapat memakai API join/response runtime setelah activity/session tersedia. Jangan expose SQLite production atau cookie admin ke AI sebagai solusi permanen.

### Pilihan C — Admin Authoring API (direkomendasikan untuk integrasi jangka panjang)

Tambahkan versi route terpisah, misalnya `/api/v1/admin/activities`, dengan desain minimum:

- Auth service-to-service: random high-entropy bearer token, hash token di DB, scope/permission, expiry/rotation/revocation. Simpan secret di local secret manager/environment, bukan prompt, git, atau log.
- TLS only. Jangan expose API key di frontend.
- `POST /api/v1/admin/activities` menerima `type`, `title`, dan idempotency key; hanya membuat **draft**, tidak launch.
- Subresources tervalidasi: `/activities/{id}/board-columns`, `/crossword-entries`, `/questions`, `/options`.
- Satu payload nested/transaksi untuk create + initial content supaya tidak meninggalkan activity setengah jadi.
- Ownership authorization setiap operasi, Zod strict schema, payload limit, rate limit, audit log, dan error JSON konsisten.
- `GET /api/v1/admin/activities/{id}` untuk read-back; jawaban benar hanya boleh muncul pada response admin yang authorized, tidak pernah pada student payload.
- `POST /activities/{id}/sessions` menjadi operasi terpisah; default session `draft`. `POST /sessions/{id}/state` untuk Open/Close harus izin eksplisit.
- Tidak ada endpoint yang menerima SQL, path file arbitrary, atau internal filesystem path.
- Opsional: pembatasan source network/private VPN dan scopes khusus agent.

Kontrak authoring API ini adalah **rekomendasi, belum terimplementasi**. Jangan mengirim request ke path contoh tersebut hingga route benar-benar ditambahkan dan diuji.

## Hal yang jangan dilakukan

- Jangan mengarang `/api/activities` atau memakai SvelteKit `?/create` sebagai endpoint stabil.
- Jangan tulis DB production langsung dari AI/script rutin; ini melewati validation, ownership, audit, dan aturan lifecycle.
- Jangan memberi peserta/admin cookie pada model, prompt, tool transcript, atau log yang tidak dikendalikan.
- Jangan menyimpan password/token/key di Markdown skill atau dokumen ini.
- Jangan launch/open session otomatis dari aksi “buat board” kecuali pemilik menyebutkannya.
- Jangan menyimpulkan data yang tidak ada dari endpoint; student APIs harus tetap menghilangkan answer key dan data participant lintas sesi.

## File source of truth

- API routes: `src/routes/api/`
- Admin library form actions: `src/routes/admin/+page.server.ts`
- Board editor form actions: `src/routes/admin/activities/[id]/board/+page.server.ts`
- Crossword editor actions (saat ini form actions, belum REST authoring API): `src/routes/admin/activities/[id]/crossword/+page.server.ts`
- Participant/session authorization dan token expiry: `src/lib/server/sessions.ts`, `src/lib/server/http.ts`, service tiap activity
- API/application roadmap: `docs/PLANNING.md`, `docs/FEATURES.md`
- Workflow skill: `skills/edu-nara-activity-builder/SKILL.md`

Jika route berubah, perbarui inventory ini dan uji auth/ownership, payload, dan read-back sebelum menyebut endpoint didukung.