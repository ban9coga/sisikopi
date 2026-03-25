# Supabase Migration

Project POS ini sekarang sudah punya jalur transisi bertahap dari `localStorage` ke Supabase.

## 1. Buat project Supabase

Siapkan project baru di Supabase, lalu catat:

- `Project URL`
- `anon public key`
- `service_role key`

## 2. Jalankan schema SQL

Buka SQL Editor Supabase, lalu jalankan isi file:

- `supabase/schema.sql`

Schema ini membuat tabel:

- `branches`
- `app_users`
- `products`
- `product_option_groups`
- `product_option_choices`
- `orders`
- `order_items`

## 3. Isi environment variable

Salin `.env.example` menjadi `.env.local`, lalu isi:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Untuk Vercel, isi value yang sama di Project Settings -> Environment Variables.

## 4. Jalankan project

```powershell
npm install
npm run dev
```

Saat env Supabase terisi, app akan otomatis pindah ke mode Supabase.

## 5. Cara kerja mode transisi

Arsitektur saat ini:

1. `app/page.js` memanggil helper di `lib/store.js`
2. `lib/store.js` mendeteksi mode:
   - tanpa env Supabase -> fallback ke `lib/local-store.js`
   - dengan env Supabase -> panggil API route
3. API route memanggil `lib/supabase/repository.js`
4. Repository membaca/menulis data ke Supabase

Keuntungan pendekatan ini:

- mode lokal lama tetap aman
- migrasi bisa dilakukan bertahap
- UI tidak perlu dirombak total sekaligus

## 6. Seed data demo

Endpoint bootstrap akan memastikan data demo tersedia:

- branch demo
- user demo
- produk demo

Seed berjalan saat startup app atau request pertama ke API Supabase.

## 7. Status refactor saat ini

Yang sudah pindah ke jalur Supabase:

- login
- bootstrap data
- daftar cabang
- daftar produk
- tambah/edit/hapus produk
- checkout order
- update status order
- laporan per tanggal / range

Yang masih transitional:

- session login masih disimpan di browser untuk kebutuhan UI
- auth belum memakai Supabase Auth
- akses database masih lewat server route dengan service role key

## 8. Next step yang saya sarankan

Urutan berikutnya paling rapi:

1. pindahkan session ke cookie server-side
2. ganti login custom ke Supabase Auth atau server session sendiri
3. tambahkan Row Level Security bila nanti user mulai akses langsung via Supabase client
4. pecah store ke server actions / route handlers per domain
5. buat script migrasi data lama bila ingin membawa data `localStorage` lama

## 9. File penting

- `supabase/schema.sql`
- `lib/supabase/server.js`
- `lib/supabase/repository.js`
- `lib/store.js`
- `lib/local-store.js`
- `app/api/bootstrap/route.js`
- `app/api/auth/login/route.js`
- `app/api/products/route.js`
- `app/api/orders/route.js`
- `app/api/reports/route.js`
