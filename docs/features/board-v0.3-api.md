# Pengembangan Board v0.3 — Kontrak API dan Delivery

Prioritas: editor kolom, composer mahasiswa, moderasi admin, tampilan board dan
SSE tersambung end-to-end. API persistensi saja bukan fitur selesai.
Setelah source siap: cek murah dan otorisasi terarah, commit/push GitHub,
deploy production Pi 5, lalu cek health dan alur post/moderasi live.
Test stabilitas luas menunggu tahap akhir sesuai `../PLANNING.md` §13.

Papan kolaborasi kolom teks. Postingan berstatus `pending` (moderasi) secara otomatis; tampilan publik hanya menerima `approved`.

## Model data

- `board_columns` — kolom papan milik activity bertipe `board`.
- `board_posts` — post teks, milik sesi + kolom + participant.

`board_posts`:

| Kolom                       | Tipe    | Keterangan                                      |
| --------------------------- | ------- | ----------------------------------------------- |
| `id`                        | text    | PK                                              |
| `session_id`                | text    | FK ke sesi                                      |
| `column_id`                 | text    | FK ke kolom                                     |
| `participant_id`            | text    | FK ke peserta                                   |
| `body`                      | text    | teks maks 500 karakter                          |
| `status`                    | text    | `pending` (default) \| `approved` \| `rejected` |
| `position`                  | integer | urutan dalam kolom                              |
| `created_at` / `updated_at` | integer | epoch ms                                        |

## Validasi server

- `body`: non-kosong, maks **500 karakter** (dihitung per code point Unicode), karakter kontrol ditolak.
- `columnId`: string non-kosong maks 100 karakter.
- `status`: enum `pending | approved | rejected`.
- `ids` (reorder): array unik, panjang sama dengan post kolom, semua id harus milik kolom + sesi.

## Endpoint

### `POST /api/boards/[sessionCode]/posts`

Kirim post baru. Peserta terautentikasi via cookie `edu_p_<sessionId>`; sesi harus `open`.

Body: `{ columnId, body }`

Respons `200`: `{ ok: true, postId, status: "pending", position }`

### `GET /api/boards/[sessionCode]/posts`

Baca papan. Admin (cookie `edu_admin`) menerima semua status; publik hanya `approved`.

Respons `200`: `{ ok: true, columns: [{id,title,position}], posts: [{id,columnId,body,status,position,createdAt}] }`

### `POST /api/boards/posts/[postId]/moderate`

Moderasi post. Admin wajib.

Body: `{ status }` (atau `{ action }`)

Respons `200`: `{ ok: true, postId, status }`

### `POST /api/boards/[sessionCode]/columns/[columnId]/order`

Simpan urutan post. Admin wajib.

Body: `{ ids: [postId, ...] }`

Respons `200`: `{ ok: true, columnId, ids }`

## Otorisasi

- Baca publik: tanpa autentikasi, hanya post `approved`.
- Post: peserta valid pada sesi.
- Moderasi + reorder: admin pemilik activity; selain itu 401/400.

## Titik penerbitan event (SSE)

Diterbitkan hanya setelah penyimpanan berhasil, pada ruangan sesi ID.

| Nama event             | Payload                               | Keterangan                                                    |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------- |
| `board.post.new`       | `{ postId, columnId, status }`        | post baru tersimpan (pending)                                 |
| `board.post.moderated` | `{ postId, columnId, status, body? }` | status berubah ke pending/approved (body hanya saat approved) |
| `board.post.removed`   | `{ postId, columnId }`                | rejected — tanpa konten, hapus dari tampilan publik           |
| `board.reordered`      | `{ columnId, ids }`                   | urutan tersimpan admin                                        |

Integrasi stream, otorisasi per event, dan reconnect termasuk delivery fitur Board.
Lapisan persistensi boleh dikerjakan dahulu; fase baru selesai setelah UI/API/SSE
terhubung, commit terkonfirmasi di GitHub, dan source yang sama live di Pi 5.
