# SUARALOKA — suaraloka.com

Portal berita siap dipasang ke **GitHub → Cloudflare Workers**. Termasuk halaman beranda, daftar berita, pencarian/kategori, detail artikel SEO, halaman tentang/kontak, dan dashboard admin `/admin/` dengan login, CRUD berita, draft/publish, dan upload gambar.

## 1. Unggah ke GitHub

Buat repository baru (misalnya `suaraloka`), lalu **unggah seluruh isi folder ini ke root repository**. Jangan hanya unggah file ZIP sebagai satu file. Struktur `public/`, `src/`, `schema.sql`, `package.json`, dan `wrangler.toml` harus tetap utuh.

## 2. Siapkan Cloudflare

Di komputer dengan Node.js terpasang:

```bash
npm install
npx wrangler login
npx wrangler d1 create suaraloka-db
npx wrangler r2 bucket create suaraloka-media
```

**PENTING:** R2 mungkin memerlukan aktivasi R2/billing di akun Cloudflare. Salin `database_id` dari hasil perintah `d1 create` ke `wrangler.toml` menggantikan `GANTI_DENGAN_DATABASE_ID`.

Jalankan:

```bash
npm run db:init
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npm run deploy
```

Isi `ADMIN_PASSWORD` dengan password panjang yang unik. Isi `SESSION_SECRET` dengan string acak **minimal 32 karakter**, berbeda dari password admin. Secret tidak boleh ditulis ke repository. Jika mengembangkan lokal, gunakan `.dev.vars` (diabaikan Git), berisi `ADMIN_PASSWORD=...` dan `SESSION_SECRET=...`, dan jalankan migrasi lokal dengan `npx wrangler d1 execute suaraloka-db --local --file=./schema.sql`.

## 3. Hubungkan domain

Cloudflare Dashboard → Workers & Pages → Worker `suaraloka` → Settings / Domains & Routes → **Add Custom Domain** → `suaraloka.com`. Domain harus dikelola pada zona Cloudflare yang sama. Opsional tambahkan `www.suaraloka.com` dan redirect ke domain utama.

Jika memakai GitHub auto-deploy, hubungkan repository di Cloudflare Workers Builds, gunakan build command `npm install` dan deploy command `npx wrangler deploy`. **Buat database, bucket, dan secret terlebih dahulu**. Konfigurasi D1/R2 ada di `wrangler.toml`.

## 4. Mengelola berita

Buka `https://suaraloka.com/admin/`, login dengan `ADMIN_PASSWORD`, tulis judul, ringkasan, isi, kategori, unggah foto, lalu klik **Terbitkan Berita** atau **Simpan Draft**. Berita terbit otomatis muncul di beranda dan halaman `/berita/`.

Gambar diunggah ke R2, maksimal 5 MB (JPG/PNG/WebP/GIF). Konten berita saat ini menggunakan **teks biasa dengan pemisah paragraf**, bukan rich-text HTML. Penghapusan artikel tidak otomatis menghapus gambar dari R2.

## Catatan sebelum peluncuran

- Situs awal **tidak berisi berita faktual yang dikarang**. Publikasikan berita asli melalui dashboard.
- Lengkapi halaman Tentang dan Kontak dengan identitas redaksi, alamat, email, kebijakan editorial, dan informasi badan usaha yang benar.
- Login admin memakai satu password; untuk tim redaksi besar, tambahkan multiuser, 2FA, audit log, dan rate limiting Cloudflare pada `/api/login`.
- Cadangkan database D1 dan media R2 secara berkala. Proteksi login Cloudflare WAF rate limiting sangat dianjurkan.
- `wrangler.toml` berisi placeholder database ID yang **wajib** diganti sebelum deploy.
