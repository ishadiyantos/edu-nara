# Edu Nara — aturan kerja Hermes/Kanban

## Scope dan keselamatan

- Workspace ini dipakai oleh task Kanban. Jangan menjalankan `git reset`, `git clean`, checkout yang membuang perubahan, atau menghapus pekerjaan task lain.
- Sebelum mengubah kode, baca `docs/PLANNING.md`, `docs/FEATURES.md`, dan `docs/PROMPT.md` bila relevan.
- Kerjakan hanya scope task aktif. Jika menemukan perubahan task lain di working tree, jangan masukkan perubahan itu ke commit.
- Jangan pernah commit `.env`, password, token, private key, database, WAL/SHM, backup, upload, atau artefak rahasia.

## Verifikasi wajib sebelum selesai

1. Jalankan test/check yang relevan dengan task.
2. Jalankan `git diff --check`.
3. Audit `git status` dan `git diff --stat`.
4. Stage hanya file yang memang termasuk scope task; jangan gunakan `git add .` atau `git commit -a`.
5. Gunakan Conventional Commit berbahasa Inggris (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).

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
