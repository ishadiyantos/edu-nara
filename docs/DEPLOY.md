# Delivery Fitur Edu Nara ke Production Pi 5

Target yang disetujui: Pi 5 ARM64, `/DATA/AppData/edu-nara` pada disk lokal.
Path lama `/DATA/App` tidak ada; jangan gunakan. Jangan menaruh DB WAL pada NFS/SMB.
Source boleh disinkron dari workspace NFS, runtime data harus lokal.

## Struktur aman

```text
/DATA/AppData/edu-nara/
  private/.env       # deployment user, mode 600; bukan bagian source
  data/              # UID 1000 (node), SQLite WAL
  releases/<id>/     # source immutable per rilis, .env symlink ke private/.env
  current            # symlink hanya dipromosikan setelah healthy
  staging/           # pengujian terpisah, bukan deployment
```

Pemilik platform menyediakan `ADMIN_EMAIL` dan password acak >=16 karakter secara
privat. Tidak ada password default atau registrasi publik. Startup gagal saat DB
baru belum punya seed valid; startup lama tidak mereset password. Setelah akun
dibuat, hapus ADMIN_PASSWORD/ADMIN_EMAIL dari environment deployment jika tidak
lagi diperlukan. Jangan mencetak `.env`, `docker inspect` environment, atau
`docker compose config` tanpa filter ke log/chat.

Untuk HTTP LAN yang disetujui:

```dotenv
ORIGIN=http://10.200.10.5:3000
COOKIE_SECURE=false
EDU_NARA_BIND_IP=10.200.10.5
```

`COOKIE_SECURE=false` terpisah dari NODE_ENV; hanya untuk LAN terpercaya. HTTP
membocorkan password/cookie bagi penyadap jaringan. Untuk publik gunakan HTTPS,
ORIGIN URL eksternal persis, COOKIE_SECURE=true. Jangan membuka port dev Vite.
Jangan mengaktifkan trust forwarded headers tanpa proxy terpercaya yang menyaringnya.

## Rilis per fitur

1. Selesaikan source fitur. Cek terarah auth/keamanan/migrasi/data sebelum aktivasi production; tidak perlu suite luas.
2. Audit diff, stage hanya file task, commit, push GitHub, dan cocokkan `git rev-parse HEAD` dengan `git ls-remote origin refs/heads/main`. Jangan force-push atau ikutkan pekerjaan lain.
3. Siapkan checkout bersih dari SHA yang sudah dipush; jalankan script dari checkout itu. Script mentransfer source direktori kerja, sehingga working tree campuran tidak boleh dideploy.
4. Build ARM64 di Pi 5 sebelum mengganti container aktif. Gunakan release baru dan simpan jalur rollback/data persisten.
5. Tunggu script exit 0; cek `current`, container healthy, `/health`, serta satu alur fitur live. Catat commit SHA dan release yang sama.
6. Test stabilitas luas dilakukan pada tahap akhir MVP. Load/restore/destructive checks hanya pada staging/DB terisolasi, bukan production.

Jika push ditolak atau deploy gagal, laporkan blocker; jangan klaim task selesai. Perubahan dokumentasi saja tidak perlu restart production.

Urutan deploy fitur: source code end-to-end → check/smoke murah seperlunya → push GitHub → deploy production Pi 5 → verifikasi health dan alur nyata. Test stabilitas penuh (lint + unit + integration + E2E semua viewport + load/regression bila perlu) dijalankan setelah fitur-fitur selesai, sebagai gate rilis versi — lihat PLANNING.md §13.
Node22 Docker builder mengompilasi better-sqlite3 native untuk arsitektur host.
`pnpm@12.6.0`, frozen lock, allowBuilds hanya esbuild/better-sqlite3. Runtime
non-root dengan dependency production; migrasi dan seed berjalan sebelum server.

```sh
# Review manifest dan langkah tanpa kontak remote:
./scripts/deploy.sh --dry-run
# Setelah commit dipush, source SHA cocok, dan cek keselamatan terpenuhi:
./scripts/deploy.sh
```

Script transfer tar manifest terpilih (tanpa .env, DB, node_modules), tidak memakai
rsync --delete dan tidak menyentuh aplikasi lain/tunnel. Compose memakai
EDU_NARA_IMAGE, EDU_NARA_DATA_DIR, EDU_NARA_BIND_IP. Folder `data` harus sudah
writable UID1000; `private/.env` milik deployment user mode400/600. `current`
tidak berubah jika health gate gagal, tetapi container yang berjalan mungkin
sudah berubah: lakukan rollback eksplisit. Jangan jalankan `docker system prune`
sebagai troubleshooting rutin.

Health `/health` dan `/api/health` menjalankan query DB nyata. Proxy SSE wajib
mematikan buffering dan idle timeout >60s. Jalankan satu worker, bukan cluster.

## Backup online dan restore terisolasi

Bagian ini referensi operasi, bukan task wajib yang diulang setiap fitur. Periksa keberadaan script dan dukungan env pada release sebelum memasang cron; contoh di bawah bukan bukti job sudah tersedia/aktif.

Runtime **tidak mengandalkan sqlite3 CLI**. `scripts/backup.ts` memakai native
SQLite backup API, mengambil committed WAL secara konsisten, menolak overwrite,
file tujuan mode600. Direktori tujuan wajib ada dan writable user node.

Untuk jadwal otomatis, sediakan direktori backup lokal terpisah, lalu panggil
`node --import tsx scripts/scheduled-backup.ts` via cron di host. Retensi snapshot
aktif hanya bila `BACKUP_RETENTION_DAYS` disetel positif; hapus hanya snapshot
bernama `edu-nara-YYYYMMDDTHHMMSSZ.db`. Gunakan media di luar Pi untuk salinan
pemulihan bencana. Contoh root crontab, backup tiap hari pukul 02:15 WIB dan
sesi bersih pukul 02:45 WIB:

```cron
15 2 * * * cd /DATA/AppData/edu-nara/current && docker compose --project-name edu-nara exec -T app node --import tsx scripts/scheduled-backup.ts >> /var/log/edu-nara-backup.log 2>&1
45 2 * * * cd /DATA/AppData/edu-nara/current && docker compose --project-name edu-nara exec -T app node --import tsx scripts/maintenance.ts >> /var/log/edu-nara-maintenance.log 2>&1
```

Set `DATABASE_PATH=/app/data/edu-nara.db`, `BACKUP_DIR` ke direktori backup persisten
terpisah yang writable user node, dan `BACKUP_RETENTION_DAYS` (mis. `30`) pada
service/container environment. Cron heredity host environment tidak otomatis masuk
ke container; definisikan di compose environment. Jangan arahkan BACKUP_DIR ke
volume produksi yang sama. Backup job gagal tertutup dan mempertahankan snapshot
lama jika snapshot baru gagal. Log perlu rotasi; pastikan job tak berjalan paralel
(jadwal harian tidak tumpang tindih).

`scripts/maintenance.ts` menghapus sesi admin dan token peserta kedaluwarsa, lalu
sesi kelas berstatus `ended` yang usianya melewati `SESSION_RETENTION_DAYS` (default
180 hari). Nilai 0 mempertahankan hanya sesi berakhir hari ini; sesi yang masih hidup
atau draft tidak disentuh. Poll responses/options, peserta, sesi, pertanyaan dan
aktivitas yatim untuk sesi yang sudah memenuhi kriteria ikut dihapus dalam transaksi.
Uji dulu di staging dan verifikasi laporan jumlah baris; retention ini menghapus
riwayat kelas permanen. Ganti hari retensi hanya lewat env container. Belum menghapus
aktivitas yang tanpa sesi.

Salin snapshot selesai ke media backup di luar Pi dan batasi akses (berisi hash akun/nama peserta). Jangan tar/copy DB aktif beserta WAL sembarang lalu menganggapnya backup konsisten.

Uji restore **salinan** pada direktori lokal terpisah: gunakan snapshot sebagai
`DATABASE_PATH`, jangan mount volume produksi. Contoh uji terisolasi terhadap backup:

```sh
mkdir -m 700 /tmp/edu-nara-restore
cp /DATA/AppData/edu-nara/backups/edu-nara-YYYYMMDDTHHMMSSZ.db /tmp/edu-nara-restore/restore.db
DATABASE_PATH=/tmp/edu-nara-restore/restore.db node --import tsx scripts/migrate.ts
node -e "const D=require('better-sqlite3');const d=new D('/tmp/edu-nara-restore/restore.db');console.log(d.pragma('integrity_check',{simple:true}),d.prepare('select count(*) as admins from admin_users').get());d.close()"
DATABASE_PATH=/tmp/edu-nara-restore/restore.db ORIGIN=http://127.0.0.1:3001 COOKIE_SECURE=false PORT=3001 node --env-file=/DATA/AppData/edu-nara/private/.env --import tsx scripts/start.ts
```

Verify integrity `ok`, expected admin/activity/session/response counts, health endpoint
and login/session access in isolated browser. Do not expose restored instance on network.
Automated integration tests verify WAL snapshot restore, integrity and records on a
temporary DB; this is not proof of a production restore. Never restore over live DB.
For recovery: stop app, preserve old volume copy, restore validated DB in new directory,
ensure no stale WAL/SHM, set UID1000 ownership, start app, verify health and data.


Rollback source memakai image tag rilis sebelumnya dan `.env` yang sama; repoint
current hanya setelah healthy. Rollback schema bukan otomatis; restore backup atau
pilih rilis kompatibel, jangan menurunkan migrasi secara spekulatif.
