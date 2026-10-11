---
name: product-kickoff
description: Interview owners; create seven product docs before build.
---

# Product Kickoff

## Kapan skill ini dipakai

Pakai skill ini saat pengguna menjalankan $product-kickoff atau /product-kickoff, meminta memulai atau membangun produk/aplikasi baru, atau meminta spesifikasi produk sebelum implementasi. Untuk Codex, panggil dengan $product-kickoff; Antigravity dan Hermes menyediakan /product-kickoff.

Perlakukan kickoff sebagai gerbang sebelum implementasi produk: lakukan interview dulu dan hasilkan dokumen sebelum menulis kode produk. Jika pengguna dalam permintaan yang sama juga meminta implementasi, selesaikan dokumen lebih dulu lalu lanjutkan hanya sesuai permintaannya. Jika pengguna hanya meminta perubahan kecil pada produk yang sudah punya dokumen lengkap, baca dokumen terkait dan interview hanya untuk gap yang berdampak.

Gunakan bahasa pengguna. Jangan mulai dengan kuesioner panjang. Maksimal tiga pertanyaan yang saling berkaitan dalam satu giliran; lewati hal yang sudah dijawab pengguna atau sudah tegas di repo/dokumen.

## Alur kerja

1. **Pahami konteks.** Pada produk yang sudah memiliki repo, baca struktur, instruksi proyek, serta dokumen produk yang relevan. Catat keputusan yang sudah ada agar tidak ditanyakan ulang. Untuk produk baru, gunakan konteks percakapan sebagai sumber awal.
2. **Wawancarai secara adaptif.** Tanyakan hanya informasi yang belum diketahui. Bergerak dari tujuan produk dan pengguna ke fitur, journey, visual, data, teknologi, arsitektur, lalu rencana build. Ikuti jawaban pengguna; jangan memaksa urutan jika topik sudah jelas.
3. **Catat status keputusan.** Selama interview, bedakan dengan jelas:
   - **Terkonfirmasi:** diputuskan pengguna atau didukung konteks yang ada.
   - **Usulan AI:** rekomendasi yang belum disetujui pengguna.
   - **Asumsi / TBD:** belum diketahui atau belum dikunci; sebutkan alasan dan dampaknya.
   Jangan mengubah usulan menjadi fakta. Jika pengguna meminta AI memilih, pilih opsi yang cocok dan catat alasan singkatnya.
4. **Tutup gap yang penting.** Untuk keputusan teknis yang mengubah biaya, risiko keamanan, kepatuhan, lock-in, atau arah arsitektur, berikan rekomendasi singkat dan minta keputusan pengguna jika mereka belum mendelegasikan pilihan. Untuk hal yang belum bisa diputuskan, tandai TBD tanpa mengarang.
5. **Generate segera setelah siap.** Interview selesai jika seluruh bagian wajib bisa ditulis sebagai keputusan, N/A dengan alasan, atau TBD yang jelas dan tidak menghalangi spesifikasi lainnya. Setelah itu langsung buat ketujuh dokumen; jangan meminta persetujuan tambahan untuk mulai menulisnya.
6. **Periksa silang.** Pastikan dokumen tidak saling bertentangan, requirement dapat ditelusuri ke flow dan plan, dan pilihan stack sesuai dengan arsitektur. Rapikan kontradiksi yang dapat diselesaikan dari keputusan terkonfirmasi; tampilkan yang belum terselesaikan sebagai open decision.
7. **Serahkan hasil.** Tampilkan lokasi ketujuh file, ringkas keputusan utama, dan sebutkan TBD/asumsi yang memengaruhi build. Dokumen menjadi sumber kebenaran saat implementasi dimulai.

Jangan mengarang angka metrik, data kepatuhan, vendor, API, warna, atau keputusan lain yang tampak final. Untuk kebutuhan yang tidak berlaku—misalnya backend pada produk statis—tulis N/A beserta alasan. Jika suatu requirement belum cukup jelas untuk acceptance criteria yang bisa diuji, tanyakan sebelum menutup interview atau tandai TBD.

## Cakupan interview

Pastikan interview mencakup area berikut. Ubah pertanyaan sesuai produk dan jangan menanyakan ulang jawaban yang sudah ada.

- **Produk dan masalah:** nama/konsep produk, masalah yang diselesaikan, alternatif saat ini, alasan produk perlu dibuat, batasan bisnis, dan hasil yang diharapkan.
- **Pengguna:** target user, persona atau segmen, kebutuhan dan konteks penggunaan, serta pihak lain yang memengaruhi atau mengoperasikan produk.
- **Fitur dan scope:** user stories, prioritas, kebutuhan fungsional per fitur, acceptance criteria, scope in/out, dependensi, dan success metrics. Usahakan metrik punya baseline, target, cara ukur, dan jangka waktu jika informasinya tersedia.
- **Journey:** entry point tiap flow, daftar screen/page, aksi pengguna dan hasilnya, decision branch, struktur navigasi, serta loading, empty, success, dan error states.
- **Visual:** brand dan referensi, aturan logo, palet warna dengan kode hex, tipografi dan hierarki ukuran, spacing/layout, komponen UI, responsive behavior, accessibility dasar, serta do's/don'ts.
- **Teknologi dan operasional:** frontend, backend, database, hosting, DNS, form handling, analytics, version control; third-party API/integrasi; dev/staging/prod; deployment; security/compliance; target performance/scalability; dan testing requirements.
- **Data:** entity/table, field dan tipe, relasi, role dan permission baca/tulis, validasi, privasi, serta retensi/penghapusan.
- **Arsitektur dan rencana build:** komponen dan tanggung jawab, aliran data, struktur folder/modul, API contract antar-layer, alasan keputusan teknis, milestone, dependensi task, acceptance criteria milestone, testing checkpoints, dan definition of done.

Untuk pilihan teknologi, jangan hanya mencatat “pakai stack modern”. Kunci produk/vendor/layanan spesifik yang dipilih dan versi/runtime yang relevan bila diperlukan. Jika pengguna belum tahu, rekomendasikan pilihan sesuai kebutuhan dan batasannya; bedakan pilihan final dari TBD.

## Dokumen yang harus dibuat

Gunakan lokasi dokumentasi produk yang sudah menjadi konvensi repo. Jika belum ada, simpan di docs/product/. Buat atau perbarui file berikut:

1. **PRD.md** — problem statement; target user/persona; user stories; functional requirements per fitur dengan acceptance criteria; scope in/out; success metrics.
2. **TRD.md** — stack lengkap sesuai cakupan teknis di atas; integrasi/API; lingkungan dan deploy; security/compliance; target performa dan skala; testing requirements. Tulis pilihan secara spesifik dan jelaskan TBD yang tersisa.
3. **app-flow.md** — daftar seluruh screen/page; Mermaid flow diagram; entry point; aksi dan hasil per screen; decision branches; loading, empty, error, success states; struktur navigasi.
4. **design-brief.md** — palette hex; typography dan hirarki; spacing/layout; library/pola komponen; aturan logo; responsive dan accessibility dasar; do's/don'ts; referensi visual.
5. **backend-schema.md** — entity/table, field, tipe, relasi; access control; validasi; aturan privasi dan retensi. Jika tidak ada backend, tulis N/A dan alasannya.
6. **implementation-plan.md** — phases/milestones; task breakdown dan dependency; acceptance criteria tiap milestone; testing checkpoints; definition of done.
7. **architecture.md** — system diagram tingkat tinggi dalam Mermaid; komponen dan tanggung jawab; data flow; struktur folder/modul; API contract antar-layer; decision log singkat yang menjelaskan alasan pilihan teknis.

Ikuti format dan lokasi yang sudah dipakai repo bila sudah ada. Jangan menambahkan dokumen lain tanpa kebutuhan. Jika file target sudah ada, baca dan pertahankan informasi yang masih berlaku; gabungkan atau perbarui isinya, jangan menghapus materi berguna secara membabi buta.

## Konsistensi antar dokumen

- Beri ID sederhana pada user story dan requirement agar mudah dirujuk, misalnya US-01 dan FR-01.
- Setiap fitur yang ada di PRD harus tercakup dalam flow atau dijelaskan kenapa tidak punya UI flow.
- Flow, data schema, permission, validation, dan security harus mendukung requirement yang sama.
- TRD mencatat pilihan teknologi dan operasi; architecture menjelaskan bagaimana komponen pilihan tersebut terhubung. Jangan membuat daftar stack yang bertentangan dengan diagram arsitektur.
- Milestone dan task di implementation plan harus menutup requirement dan acceptance criteria yang tercatat.
- Cantumkan TBD/asumsi pada dokumen yang terdampak. Jangan menyembunyikannya dalam narasi atau menyebut spesifikasi “locked” jika masih ada pilihan penting yang belum diputuskan.
