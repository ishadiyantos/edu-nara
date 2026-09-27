# Edu Nara — aturan kerja Hermes/Kanban

## Scope dan keselamatan

- Workspace ini dipakai oleh task Kanban. Jangan menjalankan `git reset`, `git clean`, checkout yang membuang perubahan, atau menghapus pekerjaan task lain.
- Sebelum mengubah kode, baca `docs/PLANNING.md`, `docs/FEATURES.md`, dan `docs/PROMPT.md` bila relevan.
- Kerjakan hanya scope task aktif. Jika menemukan perubahan task lain di working tree, jangan masukkan perubahan itu ke commit.
- Jangan pernah commit `.env`, password, token, private key, database, WAL/SHM, backup, upload, atau artefak rahasia.

## Prioritas implementasi

- Fokus utama: fitur berjalan end-to-end di aplikasi nyata. Jangan menghabiskan putaran kerja untuk menambah test sebelum alur fitur stabil.
- Kerjakan satu task pada workspace ini. Dispatcher dibatasi satu worker per profile; jangan membuat worker paralel tambahan.
- Jalankan aplikasi, smoke check, dan verifikasi deploy di Pi5 setelah fitur siap. Workspace NFS bukan tempat utama untuk install dependency atau test berat.
- Test serius (full unit/integration/E2E/load/regression) dilakukan sebagai gate setelah fitur selesai dan terdeploy di Pi5, bukan berulang pada setiap langkah kecil.
- Selama implementasi cukup lakukan check murah yang langsung terkait perubahan, cek manual alur utama, dan satu smoke test bila tidak menghambat fitur.

## Verifikasi wajib sebelum selesai

1. Pastikan alur fitur utama benar-benar terimplementasi; jangan klaim selesai hanya karena test parsial lulus.
2. Jalankan check/smoke test murah yang relevan bila dependency dan runner siap.
3. Jalankan `git diff --check`.
4. Audit `git status` dan `git diff --stat`.
5. Stage hanya file yang memang termasuk scope task; jangan gunakan `git add .` atau `git commit -a`.
6. Gunakan Conventional Commit berbahasa Inggris (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
7. Full test suite menunggu deploy Pi5 dan gate rilis, kecuali perubahan menyentuh auth, keamanan, migrasi DB, atau backup/restore.

## Batas token dan blocker

- Jangan mengulang install dependency atau test yang sama tanpa perubahan kode atau bukti baru.
- Jika runner Pi5/security guard menghalangi transfer, catat blocker lalu lanjutkan implementasi fitur yang bisa dikerjakan lokal; jangan loop mencoba jalur yang sama.
- Jika scope working tree bercampur, jangan commit/push paksa. Pisahkan hanya bila aman; jika tidak, laporkan blocker.


## Commit dan push per tahapan

Setiap task/fase yang selesai wajib dipublikasikan ke GitHub sebelum memanggil `kanban_complete`:

```bash
flock /tmp/edu-nara-git-push.lock bash -lc '
  git add -- <file-scope-task>
  test "$(git diff --cached --name-only | wc -l)" -gt 0
  git diff --cached --check
  git commit -m "<conventional commit message>"
  git push origin HEAD:main
  git ls-remote origin refs/heads/main
'
```

- Jangan force-push.
- Jika `git push` ditolak karena non-fast-forward, konflik, kredensial, atau perubahan scope tidak dapat dipisahkan, jangan memaksa. Tandai task `blocked` dan jelaskan errornya.
- Setelah push berhasil, catat SHA commit, branch/ref remote, test yang dijalankan, dan hasilnya di `kanban_complete`/summary task.
- Jangan mengklaim task selesai hanya karena file sudah berubah lokal; task selesai berarti verifikasi lulus dan commit sudah terkonfirmasi di `origin/main`.

## Urutan kerja

- Jangan mulai fase berikutnya sebelum dependensi fase sebelumnya selesai dan sudah dipush.
- Jika task tidak bisa dipublikasikan secara aman karena worker lain sedang mengubah working tree, berhenti tanpa merusak perubahan dan laporkan sebagai blocker.
