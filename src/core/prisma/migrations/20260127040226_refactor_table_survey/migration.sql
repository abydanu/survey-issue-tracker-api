-- CreateEnum
CREATE TYPE "Status" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SYNCED', 'PENDING', 'CONFLICT', 'ERROR');

-- CreateEnum
CREATE TYPE "JenisKendala" AS ENUM ('ODP_FULL', 'JARAK_PT1_250', 'BLANK_FO', 'JARAK_JAUH_500', 'BLANK_TIANG', 'NEED_MATAM_3PCS');

-- CreateEnum
CREATE TYPE "PlanTematik" AS ENUM ('PT1', 'PT2S', 'PT2NS', 'PT3', 'PT4', 'TKAP');

-- CreateEnum
CREATE TYPE "StatusUsulan" AS ENUM ('REVIEW_SDI', 'BELUM_INPUT', 'REVIEW_OPTIMA', 'REVIEW_ED', 'CEK_SDI_REGIONAL', 'APPROVED', 'DROP_LOP', 'KONFIRMASI_ULANG', 'NOT_APPROVED', 'PENDING', 'CANCEL', 'OGP_IHLD', 'WAITING_CARING');

-- CreateEnum
CREATE TYPE "StatusInstalasi" AS ENUM ('REVIEW', 'SURVEY', 'INSTALASI', 'DONE_INSTALASI', 'GO_LIVE', 'CANCEL', 'PENDING', 'KENDALA', 'WAITING_BUDGET', 'DROP', 'WAITING_PROJECT_JPP', 'WAITING_CB');

-- CreateEnum
CREATE TYPE "Keterangan" AS ENUM ('PELANGGAN_BATAL', 'PT1_ONLY', 'PERIJINAN', 'AKI_TIDAK_LAYAK', 'REDESIGN', 'INDIKASI_RESELLER', 'FEEDER_HABIS', 'KENDALA_IZIN_TANAM_TN', 'PORT_OLT_HABIS', 'MATTAM_TIANG', 'DISTRIBUSI_HABIS', 'MENUNGGU_M_OLT', 'MENUNGGU_RELOKASI_TIANG_PLN', 'CORE_DISTRIBUSI_CACAT', 'MENUNGGU_CO_FEEDER', 'PORT_EA_HABIS', 'INVALID_LOCATION', 'HOLD_BY_BGES', 'WAITING_REVIT_ODP', 'HOLD_BY_PED');

-- CreateEnum
CREATE TYPE "StatusJt" AS ENUM ('APPROVE', 'NOT_APPROVE', 'DROP_BY_WITEL', 'DROP_BY_AM', 'REVENUE_KURANG', 'AKI_TIDAK_LAYAK', 'NJKI_BELUM_LENGKAP', 'AANWIJZING', 'TUNGGU_JPP', 'CANCEL_PELANGGAN', 'INPUT_PAKET_LAIN');

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "status" "Status" NOT NULL,
    "message" TEXT,
    "sheet_name" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "new_bges_b2b_olo" (
    "id" TEXT NOT NULL,
    "umur" INTEGER,
    "bln" TEXT,
    "tgl_input_usulan" TIMESTAMP(3),
    "id_kendala" TEXT NOT NULL,
    "jenis_order" TEXT,
    "datel" TEXT,
    "sto" TEXT,
    "nama_pelanggan" TEXT,
    "latitude" TEXT,
    "longitude" TEXT,
    "jenis_kendala" "JenisKendala" NOT NULL,
    "plan_tematik" "PlanTematik" NOT NULL,
    "rab_hld" DECIMAL(15,0),
    "ihld_value" BIGINT,
    "status_usulan" "StatusUsulan" NOT NULL,
    "status_ihld" TEXT,
    "id_eprop" TEXT,
    "status_instalasi" "StatusInstalasi" NOT NULL,
    "keterangan" "Keterangan" NOT NULL,
    "new_sc" TEXT,
    "nama_odp" TEXT,
    "tgl_golive" TIMESTAMP(3),
    "avai" INTEGER,
    "used" INTEGER,
    "is_total" INTEGER,
    "occ_percentage" DECIMAL(5,2),
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "last_sync_at" TIMESTAMP(3),
    "sheet_row_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "new_bges_b2b_olo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nde_usulan_b2b" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "nomor_ncx" TEXT NOT NULL,
    "status_jt" "StatusJt" NOT NULL,
    "c2r" DECIMAL(10,2),
    "alamat_instalasi" TEXT,
    "jenis_layanan" TEXT,
    "nilai_kontrak" DECIMAL(15,0),
    "rab_survey" DECIMAL(15,0),
    "nomor_nde" TEXT,
    "progress_jt" TEXT,
    "nama_odp" TEXT,
    "jarak_odp" DECIMAL(10,2),
    "keterangan" TEXT,
    "datel" TEXT,
    "sto" TEXT,
    "nama_pelanggan" TEXT,
    "latitude" TEXT,
    "longitude" TEXT,
    "ihld_lop_id" INTEGER,
    "plan_tematik" TEXT,
    "rab_hld" DECIMAL(15,0),
    "status_usulan" TEXT,
    "status_instalasi" TEXT,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "last_sync_at" TIMESTAMP(3),
    "sheet_row_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nde_usulan_b2b_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "new_bges_b2b_olo_id_kendala_key" ON "new_bges_b2b_olo"("id_kendala");

-- CreateIndex
CREATE INDEX "new_bges_b2b_olo_id_kendala_idx" ON "new_bges_b2b_olo"("id_kendala");

-- CreateIndex
CREATE INDEX "new_bges_b2b_olo_bln_idx" ON "new_bges_b2b_olo"("bln");

-- CreateIndex
CREATE INDEX "new_bges_b2b_olo_tgl_input_usulan_idx" ON "new_bges_b2b_olo"("tgl_input_usulan");

-- CreateIndex
CREATE INDEX "new_bges_b2b_olo_datel_idx" ON "new_bges_b2b_olo"("datel");

-- CreateIndex
CREATE INDEX "new_bges_b2b_olo_sto_idx" ON "new_bges_b2b_olo"("sto");

-- CreateIndex
CREATE INDEX "new_bges_b2b_olo_status_usulan_idx" ON "new_bges_b2b_olo"("status_usulan");

-- CreateIndex
CREATE INDEX "new_bges_b2b_olo_status_instalasi_idx" ON "new_bges_b2b_olo"("status_instalasi");

-- CreateIndex
CREATE UNIQUE INDEX "nde_usulan_b2b_no_key" ON "nde_usulan_b2b"("no");

-- CreateIndex
CREATE UNIQUE INDEX "nde_usulan_b2b_nomor_ncx_key" ON "nde_usulan_b2b"("nomor_ncx");

-- CreateIndex
CREATE INDEX "nde_usulan_b2b_no_idx" ON "nde_usulan_b2b"("no");

-- CreateIndex
CREATE INDEX "nde_usulan_b2b_nomor_ncx_idx" ON "nde_usulan_b2b"("nomor_ncx");

-- CreateIndex
CREATE INDEX "nde_usulan_b2b_datel_idx" ON "nde_usulan_b2b"("datel");

-- CreateIndex
CREATE INDEX "nde_usulan_b2b_sto_idx" ON "nde_usulan_b2b"("sto");

-- CreateIndex
CREATE INDEX "nde_usulan_b2b_sync_status_idx" ON "nde_usulan_b2b"("sync_status");

-- AddForeignKey
ALTER TABLE "nde_usulan_b2b" ADD CONSTRAINT "nde_usulan_b2b_nomor_ncx_fkey" FOREIGN KEY ("nomor_ncx") REFERENCES "new_bges_b2b_olo"("id_kendala") ON DELETE RESTRICT ON UPDATE CASCADE;
