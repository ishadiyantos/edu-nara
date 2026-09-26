# Edu Nara — Deployment ke Raspberry Pi 5

**Target:** `10.200.10.5` (user `ishanaracho`) · path `/DATA/AppData/edu-nara/` · akses HTTP via tunnel yang sudah ada di Pi.

Fase 0 belum wajib deploy (masih wireframe). Dokumen ini berlaku sejak Fase 1 (aplikasi mulai punya state), tapi Dockerfile & compose sudah siap dipakai untuk uji preview Fase 0 kalau mau.

---

## 1. Prasyarat (di Pi 5)

Pastikan sudah terpasang:

```bash
docker --version              # >= 24
docker compose version        # v2 plugin
git --version
```

Kalau belum, install cepat:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
```

Buat folder deploy:

```bash
sudo mkdir -p /DATA/AppData/edu-nara
sudo chown "$USER":"$USER" /DATA/AppData/edu-nara
```

---

## 2. First-time deploy (dari host development ini)

Dari `/root/nara-workspace/edu-nara/`:

```bash
# 1. Push source ke Pi (rsync, skip node_modules & data)
rsync -avz --delete \
  --exclude node_modules --exclude .svelte-kit --exclude build \
  --exclude data --exclude .git \
  ./ ishanaracho@10.200.10.5:/DATA/AppData/edu-nara/

# 2. SSH ke Pi
ssh ishanaracho@10.200.10.5

# 3. Di Pi — siapkan env & build
cd /DATA/AppData/edu-nara
cp .env.example .env
# Edit .env → isi SESSION_SECRET (32 byte random) & ADMIN_PASSWORD:
#   SESSION_SECRET=$(openssl rand -hex 32)
nano .env

# 4. Build image & jalankan
docker compose up -d --build

# 5. Cek status
docker compose ps
docker compose logs -f app
```

Akses: `http://10.200.10.5:3000/` (atau via tunnel Anda).

---

## 3. Update setelah perubahan

Dari host development:

```bash
# Sync source
rsync -avz --delete \
  --exclude node_modules --exclude .svelte-kit --exclude build \
  --exclude data --exclude .git \
  ./ ishanaracho@10.200.10.5:/DATA/AppData/edu-nara/

# Rebuild & restart (di Pi)
ssh ishanaracho@10.200.10.5 \
  'cd /DATA/AppData/edu-nara && docker compose up -d --build'
```

Atau pakai script pendek: `scripts/deploy.sh` (lihat di bawah).

---

## 4. Alternatif: build image di host, push tar ke Pi

Kalau build di Pi terlalu lambat, build di host (buildx untuk arm64) lalu kirim image:

```bash
# Di host (butuh docker buildx)
docker buildx build --platform linux/arm64 -t edu-nara:latest --load .
docker save edu-nara:latest | gzip | \
  ssh ishanaracho@10.200.10.5 'gunzip | docker load'

# Di Pi — pakai image yang di-load, skip build
ssh ishanaracho@10.200.10.5 \
  'cd /DATA/AppData/edu-nara && docker compose up -d'
```

Compose akan pakai image `edu-nara:latest` yang sudah ada (build hanya dipakai kalau image tidak ditemukan).

---

## 5. Backup

Data yang perlu di-backup: **`/DATA/AppData/edu-nara/data/`** (SQLite + uploads).

Cron harian di Pi (`crontab -e`):

```cron
15 2 * * * cd /DATA/AppData/edu-nara && \
  docker compose exec -T app sh -c 'sqlite3 /app/data/edu-nara.db ".backup /app/data/backup-$(date +\%F).db"' && \
  tar czf /DATA/Backups/edu-nara-$(date +\%F).tar.gz -C /DATA/AppData/edu-nara data && \
  find /DATA/Backups/edu-nara-*.tar.gz -mtime +14 -delete
```

Test restore ke direktori sementara sebelum dianggap sukses.

---

## 6. Troubleshooting

| Gejala | Cek |
|---|---|
| `docker compose up` gagal build | `docker system prune -f` + pastikan Pi punya minimal 2 GB RAM bebas |
| Aplikasi jalan tapi tidak bisa diakses | `ss -tlnp \| grep 3000`; cek tunnel; cek firewall Pi |
| SQLite locked / write gagal | `docker compose logs app`; pastikan volume `./data` writable oleh UID container (`nara`) |
| Health check unhealthy | `docker compose logs app`; endpoint `/` harus 200 (bukan redirect ke `/admin/login`) |

---

## 7. Script deploy pendek

`scripts/deploy.sh` (dibuat otomatis Fase 0):

```bash
#!/usr/bin/env bash
set -euo pipefail
PI_HOST="${PI_HOST:-ishanaracho@10.200.10.5}"
PI_PATH="${PI_PATH:-/DATA/AppData/edu-nara}"

echo "→ Syncing source ke $PI_HOST:$PI_PATH…"
rsync -avz --delete \
  --exclude node_modules --exclude .svelte-kit --exclude build \
  --exclude data --exclude .git --exclude 'test-results' \
  --exclude playwright-report \
  ./ "$PI_HOST:$PI_PATH/"

echo "→ Build & restart di Pi…"
ssh "$PI_HOST" "cd $PI_PATH && docker compose up -d --build"

echo "→ Log 20 baris terakhir:"
ssh "$PI_HOST" "cd $PI_PATH && docker compose logs --tail=20 app"

echo "✓ Selesai. Akses http://10.200.10.5:3000/"
```

Pakai:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```
