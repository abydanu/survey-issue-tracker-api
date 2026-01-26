# Requirements Document

## Introduction

Sistem error handling untuk validasi Zod saat ini mengembalikan array issues yang tidak user-friendly. Fitur ini akan mengubah output error validasi Zod menjadi satu string yang digabung dengan format response API yang konsisten, memudahkan frontend untuk menampilkan pesan error kepada pengguna.

## Glossary

- **Zod**: Library validasi schema untuk TypeScript
- **Error_Handler**: Global error handler di aplikasi Hono
- **Validation_Error**: Error yang terjadi ketika input tidak sesuai dengan schema Zod
- **Error_Formatter**: Helper function yang mengubah ZodError menjadi string
- **API_Response**: Format standar response API aplikasi

## Requirements

### Requirement 1: Format Error Zod Menjadi String

**User Story:** Sebagai developer frontend, saya ingin menerima error validasi dalam format string yang mudah dibaca, sehingga saya dapat menampilkannya langsung kepada pengguna tanpa perlu parsing array.

#### Acceptance Criteria

1. WHEN Error_Formatter menerima ZodError dengan satu issue, THEN Error_Formatter SHALL mengembalikan string dengan format "Field {path} {message}"
2. WHEN Error_Formatter menerima ZodError dengan multiple issues, THEN Error_Formatter SHALL menggabungkan semua error dengan separator koma dan spasi ", "
3. WHEN error path bersifat nested (contoh: user.name), THEN Error_Formatter SHALL menggabungkan path dengan titik "."
4. WHEN error message mengandung huruf kapital di awal, THEN Error_Formatter SHALL mengubahnya menjadi lowercase untuk konsistensi format
5. THE Error_Formatter SHALL tidak mengembalikan array atau object, hanya string

### Requirement 2: Response API Konsisten

**User Story:** Sebagai developer frontend, saya ingin semua error response memiliki struktur yang sama, sehingga saya dapat menangani error dengan cara yang konsisten di seluruh aplikasi.

#### Acceptance Criteria

1. WHEN validation error terjadi, THEN API_Response SHALL memiliki field "success" dengan nilai false
2. WHEN validation error terjadi, THEN API_Response SHALL memiliki field "message" dengan nilai "Validasi gagal"
3. WHEN validation error terjadi, THEN API_Response SHALL memiliki field "errors" (bukan "error") dengan nilai string hasil formatting
4. WHEN validation error terjadi, THEN API_Response SHALL mengembalikan HTTP status code 400
5. THE API_Response SHALL tidak mengandung field "issues" atau array error

### Requirement 3: Global Error Handler Integration

**User Story:** Sebagai developer backend, saya ingin error handling terpusat di satu tempat, sehingga saya tidak perlu menangani error validasi di setiap endpoint.

#### Acceptance Criteria

1. WHEN ZodError terjadi di aplikasi, THEN Error_Handler SHALL menangkap error tersebut secara otomatis
2. WHEN Error_Handler menangkap ZodError, THEN Error_Handler SHALL menggunakan Error_Formatter untuk mengubah error menjadi string
3. WHEN Error_Handler menangkap ZodError, THEN Error_Handler SHALL mengembalikan response dengan format yang konsisten
4. THE Error_Handler SHALL berada di app.onError middleware
5. THE Error_Handler SHALL tidak mengubah behavior error handling untuk error non-Zod

### Requirement 4: Custom Error Messages

**User Story:** Sebagai developer backend, saya ingin pesan error dalam Bahasa Indonesia yang jelas dan profesional, sehingga pengguna dapat memahami kesalahan input mereka.

#### Acceptance Criteria

1. WHEN field type invalid, THEN error message SHALL menampilkan "Field wajib diisi"
2. WHEN string terlalu pendek, THEN error message SHALL menampilkan "Minimal {n} karakter"
3. WHEN email format invalid, THEN error message SHALL menampilkan "Format email tidak valid"
4. THE error messages SHALL tidak mengandung kata-kata kasar atau tidak profesional
5. THE error messages SHALL konsisten menggunakan Bahasa Indonesia

### Requirement 5: Tidak Mengubah Schema dan OpenAPI

**User Story:** Sebagai developer backend, saya ingin solusi error handling yang tidak memerlukan perubahan pada schema Zod atau OpenAPI spec yang sudah ada, sehingga implementasi tidak breaking existing code.

#### Acceptance Criteria

1. THE Error_Formatter SHALL tidak memerlukan perubahan pada schema Zod yang sudah ada
2. THE Error_Formatter SHALL tidak memerlukan perubahan pada OpenAPI schema definition
3. THE Error_Formatter SHALL bekerja dengan semua tipe validasi Zod yang sudah ada
4. WHEN schema Zod baru ditambahkan, THEN Error_Formatter SHALL otomatis bekerja tanpa konfigurasi tambahan
5. THE solution SHALL backward compatible dengan error handling yang sudah ada
