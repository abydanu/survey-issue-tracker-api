import { google } from "googleapis";
import { JWT } from "google-auth-library";
import logger from "../../../infrastructure/logging/logger.js";
import type {
  SurveySummarySheetRow,
  SurveyDetailSheetRow,
  NdeUsulanB2BRow,
  NewBgesB2BOloRow,
} from "../domain/sync.entity.js";
import fs from "fs";

function loadGoogleCredentials(): Record<string, unknown> {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

  if (rawJson && rawJson.startsWith("{")) {
    const credentials = JSON.parse(rawJson) as Record<string, unknown>;

    if (typeof credentials.private_key === "string") {
      credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
    }

    return credentials;
  }

  const path =
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH?.trim() ||
    (rawJson && !rawJson.startsWith("{") ? rawJson : null);

  if (path && fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path, "utf-8")) as Record<
      string,
      unknown
    >;
  }

  if (path && !fs.existsSync(path)) {
    throw new Error(`Service account file not found: ${path}`);
  }

  throw new Error(
    "Google Service Account credentials not found. " +
      "Set GOOGLE_SERVICE_ACCOUNT_JSON (raw JSON untuk Vercel) atau GOOGLE_SERVICE_ACCOUNT_PATH (path file untuk local)."
  );
}

export class GoogleSheetsService {
  private auth: JWT;
  private sheets: any;
  private spreadsheetId: string;
  private summarySheetName: string;
  private detailSheetName: string;
  private summarySheetId: number | null = null;
  private detailSheetId: number | null = null;

  constructor() {
    const credentials = loadGoogleCredentials();

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error("Google Service Account credentials are invalid");
    }

    this.auth = new JWT({
      email: credentials.client_email as string,
      key: credentials.private_key as string,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    this.sheets = google.sheets({ version: "v4", auth: this.auth });
    this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID as string;

    this.summarySheetName = process.env.GOOGLE_SUMMARY_SHEET_NAME as string;
    this.detailSheetName = process.env.GOOGLE_DETAIL_SHEET_NAME as string;
  }

  private async ensureSheetConfigLoaded(): Promise<void> {
    if (this.summarySheetId !== null && this.detailSheetId !== null) return;

    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });

    const sheets = spreadsheet.data.sheets || [];
    const titles = sheets.map((s: any) => s.properties?.title).filter(Boolean);

    logger.info(`[DEBUG] Available sheets in spreadsheet: ${titles.join(", ")}`);
    logger.info(`[DEBUG] Looking for summary sheet: "${this.summarySheetName}"`);
    logger.info(`[DEBUG] Looking for detail sheet: "${this.detailSheetName}"`);

    const summarySheet = sheets.find(
      (s: any) => s.properties?.title === this.summarySheetName
    );
    const detailSheet = sheets.find(
      (s: any) => s.properties?.title === this.detailSheetName
    );

    if (!summarySheet || !detailSheet) {
      logger.warn(
        `Sheet name mismatch. Config summary='${
          this.summarySheetName
        }', detail='${this.detailSheetName}'. Available sheets: ${titles.join(
          ", "
        )}`
      );
    }

    const resolvedSummary = summarySheet || sheets[0];
    const resolvedDetail =
      detailSheet ||
      sheets.find((s: any) => s !== resolvedSummary) ||
      sheets[1];

    if (!resolvedSummary || !resolvedSummary.properties?.title) {
      throw new Error(
        `Tidak menemukan sheet summary. Available sheets: ${titles.join(", ")}`
      );
    }

    if (!resolvedDetail || !resolvedDetail.properties?.title) {
      throw new Error(
        `Tidak menemukan sheet detail. Available sheets: ${titles.join(", ")}`
      );
    }

    this.summarySheetName = resolvedSummary.properties.title;
    this.detailSheetName = resolvedDetail.properties.title;
    this.summarySheetId = Number(resolvedSummary.properties.sheetId);
    this.detailSheetId = Number(resolvedDetail.properties.sheetId);
    
    logger.info(`[DEBUG] Resolved summary sheet: "${this.summarySheetName}" (ID: ${this.summarySheetId})`);
    logger.info(`[DEBUG] Resolved detail sheet: "${this.detailSheetName}" (ID: ${this.detailSheetId})`);
  }

  async readSummaryData(): Promise<SurveySummarySheetRow[]> {
    try {
      await this.ensureSheetConfigLoaded();
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.summarySheetName}!A:W`,
      });

      const rows = response.data.values;
      if (!rows || rows.length < 3) {
        return [];
      }

      const dataRows = rows.slice(2);

      return dataRows

        .filter(
          (row: any[]) =>
            Array.isArray(row) &&
            row.length >= 4 &&
            String(row[3] ?? "").trim() !== ""
        )
        .map((row: any[], index: number) =>
          this.mapRowToSummary(row, index + 3)
        );
    } catch (error: any) {
      logger.error("Error reading summary data from Google Sheets:", error);
      throw new Error(
        `Gagal membaca data dari Google Sheets: ${error.message}`
      );
    }
  }

  async readRawDetailRows(): Promise<any[][]> {
    await this.ensureSheetConfigLoaded();
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.detailSheetName}!A:U`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 3) return [];
    return rows.slice(2);
  }

  async readRawSummaryRows(): Promise<any[][]> {
    await this.ensureSheetConfigLoaded();
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.summarySheetName}!A:W`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 3) return [];
    return rows.slice(2);
  }

  async readRanges(ranges: string[]): Promise<Record<string, any[]>> {
    await this.ensureSheetConfigLoaded();
    const response = await this.sheets.spreadsheets.values.batchGet({
      spreadsheetId: this.spreadsheetId,
      ranges,
      majorDimension: "COLUMNS",
    });

    const out: Record<string, any[]> = {};
    const valueRanges = response.data.valueRanges || [];
    for (let i = 0; i < ranges.length; i++) {
      const key = ranges[i];
      const values = valueRanges[i]?.values?.[0] || [];
      if (key) out[key] = values;
    }
    return out;
  }

  async readDetailData(): Promise<SurveyDetailSheetRow[]> {
    try {
      await this.ensureSheetConfigLoaded();
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.detailSheetName}!A:U`,
      });

      const rows = response.data.values;
      if (!rows || rows.length < 3) {
        return [];
      }

      const dataRows = rows.slice(2);

      return dataRows
        // PERBAIKAN: Filter baris yang benar-benar punya data (idKendala tidak kosong)
        .filter(
          (row: any[]) =>
            Array.isArray(row) && 
            row[4] && // Column E (index 4) = idKendala harus ada
            String(row[4]).trim() !== "" &&
            String(row[4]).trim() !== "-"
        )
        .map((row: any[], index: number) =>
          this.mapRowToDetail(row, index + 3)
        );
    } catch (error: any) {
      logger.error("Error reading detail data from Google Sheets:", error);
      throw new Error(
        `Gagal membaca data dari Google Sheets: ${error.message}`
      );
    }
  }

  private normalizeEnumValue(input: unknown): string | null {
    const raw = String(input ?? "").trim();
    if (!raw) return null;
    return raw
      .toUpperCase()
      .replace(/^\d+\s*/g, "")          
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  private normalizeStatusInstalasi(input: unknown): string | null {
    const raw = String(input ?? "").trim().toUpperCase();
    if (!raw) return null;
    
    const cleaned = raw.replace(/^\d+\s*/g, "");
    
    const mappings: Record<string, string> = {
      "REVIEW": "REVIEW",
      "SURVEY": "SURVEY",
      "INSTALASI": "INSTALASI",
      "DONE INSTALASI": "DONE_INSTALASI",
      "GOLIVE": "GO_LIVE",
      "GO LIVE": "GO_LIVE",
      "CANCEL": "CANCEL",
      "PENDING": "PENDING",
      "KENDALA": "KENDALA",
      "WAITING BUDGET": "WAITING_BUDGET",
      "DROP": "DROP",
      "WAITING PROJECT JPP": "WAITING_PROJECT_JPP",
      "WAITING CB": "WAITING_CB",
    };
    
    const mapped = mappings[cleaned];
    return mapped || this.normalizeEnumValue(cleaned);
  }

  private pickEnum<T extends string>(
    input: unknown,
    allowed: Set<string>
  ): T | null {
    const norm = this.normalizeEnumValue(input);
    if (!norm) return null;
    return allowed.has(norm) ? (norm as T) : null;
  }

  private denormalizeEnumValue(input: string | null | undefined): string {
    if (!input) return "";
    return String(input).replace(/_/g, " ").trim();
  }

  private normalizeNo(input: unknown, fallbackRowNumber: number): string {
    const raw = String(input ?? "").trim();
    if (!raw) return String(fallbackRowNumber).padStart(4, "0");

    const digits = raw.replace(/[^0-9]/g, "");
    if (!digits) return String(fallbackRowNumber).padStart(4, "0");
    return digits.padStart(4, "0");
  }

  private async findSummaryRowIndex(no: string): Promise<number | null> {
    try {
      await this.ensureSheetConfigLoaded();
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.summarySheetName}!A:A`,
      });

      const rows = response.data.values || [];
      const dataRows = rows.length < 3 ? [] : rows.slice(2);

      const normalizedSearchNo =
        String(no).replace(/^'/, "").replace(/^0+/, "") || "0";

      const idx = dataRows.findIndex((row: any[]) => {
        const cellValue = String(row[0] ?? "").trim();
        const normalizedCellValue =
          cellValue.replace(/^'/, "").replace(/^0+/, "") || "0";

        return (
          cellValue === no ||
          cellValue.replace(/^'/, "") === no ||
          normalizedCellValue === normalizedSearchNo
        );
      });

      return idx >= 0 ? idx + 3 : null;
    } catch (error: any) {
      logger.error("Error finding summary row index:", error);
      return null;
    }
  }

  private async findDetailRowIndex(idKendala: string): Promise<number | null> {
    try {
      await this.ensureSheetConfigLoaded();
      logger.info(`[DEBUG] Searching for idKendala ${idKendala} in sheet: "${this.detailSheetName}"`);
      logger.info(`[DEBUG] Using range: ${this.detailSheetName}!E:E`);
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.detailSheetName}!E:E`,
      });

      const rows = response.data.values || [];
      logger.info(`[DEBUG] Found ${rows.length} total rows in column E`);
      
      const dataRows = rows.length < 3 ? [] : rows.slice(2);
      const k = String(idKendala).trim();
      const idx = dataRows.findIndex(
        (row: any[]) => String(row[0] ?? "").trim() === k
      );
      
      if (idx >= 0) {
        logger.info(`[DEBUG] Found idKendala at index ${idx}, row number: ${idx + 3}`);
      } else {
        logger.info(`[DEBUG] idKendala ${idKendala} not found in sheet "${this.detailSheetName}"`);
      }
      
      return idx >= 0 ? idx + 3 : null;
    } catch (error: any) {
      logger.error("Error finding detail row index:", error);
      return null;
    }
  }

  async updateSummaryRow(
    data: Partial<SurveySummarySheetRow>
  ): Promise<boolean> {
    try {
      await this.ensureSheetConfigLoaded();
      if (!data.no) {
        throw new Error('Field "no" diperlukan untuk update');
      }

      logger.info(`Searching for summary row with no: ${data.no}`);
      const rowIndex = await this.findSummaryRowIndex(data.no);
      if (!rowIndex) {
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${this.summarySheetName}!A:A`,
        });
        const rows = response.data.values || [];
        const dataRows = rows.length < 3 ? [] : rows.slice(2);
        const availableNos = dataRows
          .map((row: any[]) => String(row[0] ?? "").trim())
          .filter(Boolean);

        logger.error(
          `Data dengan no ${
            data.no
          } tidak ditemukan di Google Sheets. Available nos: ${availableNos
            .slice(0, 10)
            .join(", ")}${availableNos.length > 10 ? "..." : ""}`
        );
        throw new Error(
          `Data dengan no ${data.no} tidak ditemukan di Google Sheets`
        );
      }

      logger.info(`Found summary row at index: ${rowIndex}`);

      const updates: Array<{ range: string; values: any[][] }> = [];
      const setCell = (col: string, value: any) => {
        updates.push({
          range: `${this.summarySheetName}!${col}${rowIndex}`,
          values: [[value ?? ""]],
        });
      };

      if (data.statusJt !== undefined)
        setCell("B", this.denormalizeEnumValue(data.statusJt));
      if (data.c2r !== undefined)
        setCell("C", data.c2r?.toString?.() ?? data.c2r ?? "");
      if (data.nomorNcx !== undefined) {
        const nomorNcxValue = data.nomorNcx ?? "";
        setCell("D", nomorNcxValue);
      }
      if (data.alamatInstalasi !== undefined)
        setCell("J", data.alamatInstalasi ?? "");
      if (data.jenisLayanan !== undefined)
        setCell("K", data.jenisLayanan ?? "");
      if (data.nilaiKontrak !== undefined)
        setCell(
          "L",
          data.nilaiKontrak?.toString?.() ?? data.nilaiKontrak ?? ""
        );
      if (data.rabSurvey !== undefined)
        setCell("P", data.rabSurvey?.toString?.() ?? data.rabSurvey ?? "");
      if (data.nomorNde !== undefined) setCell("Q", data.nomorNde ?? "");
      if (data.progressJt !== undefined) setCell("T", data.progressJt ?? "");
      if (data.namaOdp !== undefined) setCell("U", data.namaOdp ?? "");
      if (data.jarakOdp !== undefined)
        setCell("V", data.jarakOdp?.toString?.() ?? data.jarakOdp ?? "");
      if (data.keterangan !== undefined)
        setCell("W", this.denormalizeEnumValue(data.keterangan as any));

      if (updates.length === 0) {
        logger.info(
          `No editable fields provided, skip updating summary row ${rowIndex} for no: ${data.no}`
        );
        return true;
      }

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: updates,
        },
      });

      logger.info(`Updated summary row ${rowIndex} for no: ${data.no}`);
      return true;
    } catch (error: any) {
      logger.error("Error updating summary row in Google Sheets:", error);
      throw new Error(
        `Gagal mengupdate data di Google Sheets: ${error.message}`
      );
    }
  }

  async updateDetailRow(data: Partial<NewBgesB2BOloRow>): Promise<boolean> {
    try {
      await this.ensureSheetConfigLoaded();
      logger.info(`[DEBUG] updateDetailRow called for idKendala: ${data.idKendala}`);
      logger.info(`[DEBUG] Target sheet name: "${this.detailSheetName}"`);
      logger.info(`[DEBUG] Target sheet ID: ${this.detailSheetId}`);
      
      if (!data.idKendala) {
        throw new Error('Field "idKendala" diperlukan untuk update');
      }

      const rowIndex = await this.findDetailRowIndex(data.idKendala);
      
      if (!rowIndex) {
        logger.warn(`Row not found for idKendala ${data.idKendala} in detail sheet. Skipping update to avoid corruption.`);
        return false;
      }

      // First, read the existing row to verify we're targeting the correct row
      const verifyRange = `'${this.detailSheetName}'!E${rowIndex}`;
      logger.info(`[DEBUG] Verifying row by reading: ${verifyRange}`);
      
      const verifyResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: verifyRange,
      });
      
      const verifyValue = verifyResponse.data.values?.[0]?.[0];
      logger.info(`[DEBUG] Verification - Expected idKendala: ${data.idKendala}, Found: ${verifyValue}`);
      
      if (String(verifyValue).trim() !== String(data.idKendala).trim()) {
        logger.error(`[ERROR] Row verification failed! Expected ${data.idKendala} but found ${verifyValue}. Aborting update to prevent corruption.`);
        return false;
      }

      const fullRow = this.mapDetailToRow(data);
      // Skip first element (column A) to preserve row numbers
      const rowDataToUpdate = fullRow.slice(1);
      
      const updateRange = `'${this.detailSheetName}'!B${rowIndex}:U${rowIndex}`;
      logger.info(`[DEBUG] Updating range: ${updateRange}`);
      
      // Use values.update API with explicit range including sheet name in quotes
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: updateRange,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [rowDataToUpdate],
        },
      });

      // Verify the update was successful
      const postVerifyResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: verifyRange,
      });
      
      const postVerifyValue = postVerifyResponse.data.values?.[0]?.[0];
      logger.info(`[DEBUG] Post-update verification - idKendala still: ${postVerifyValue}`);

      logger.info(
        `Updated detail row ${rowIndex} for idKendala: ${data.idKendala}`
      );
      return true;
    } catch (error: any) {
      logger.error("Error updating detail row in Google Sheets:", error);
      throw new Error(
        `Gagal mengupdate data di Google Sheets: ${error.message}`
      );
    }
  }

  async appendSummaryRow(data: SurveySummarySheetRow): Promise<boolean> {
    try {
      await this.ensureSheetConfigLoaded();
      const row = this.mapSummaryToRow(data);
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.summarySheetName}!A:W`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [row],
        },
      });

      logger.info(`Appended summary row for no: ${data.no}`);
      return true;
    } catch (error: any) {
      logger.error("Error appending summary row to Google Sheets:", error);
      throw new Error(
        `Gagal menambahkan data ke Google Sheets: ${error.message}`
      );
    }
  }

  async appendDetailRow(data: NewBgesB2BOloRow): Promise<boolean> {
    try {
      await this.ensureSheetConfigLoaded();
      const row = this.mapDetailToRow(data);
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.detailSheetName}!A:U`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [row],
        },
      });

      logger.info(`Appended detail row for idKendala: ${data.idKendala || ""}`);
      return true;
    } catch (error: any) {
      logger.error("Error appending detail row to Google Sheets:", error);
      throw new Error(
        `Gagal menambahkan data ke Google Sheets: ${error.message}`
      );
    }
  }

  async deleteSummaryRow(no: string): Promise<boolean> {
    try {
      await this.ensureSheetConfigLoaded();
      const rowIndex = await this.findSummaryRowIndex(no);
      if (!rowIndex) {
        throw new Error(
          `Data dengan no ${no} tidak ditemukan di Google Sheets`
        );
      }

      if (!this.summarySheetId) {
        throw new Error("Summary sheetId tidak ditemukan");
      }

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: this.summarySheetId,
                  dimension: "ROWS",
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex,
                },
              },
            },
          ],
        },
      });

      logger.info(`Deleted summary row ${rowIndex} for no: ${no}`);
      return true;
    } catch (error: any) {
      logger.error("Error deleting summary row from Google Sheets:", error);
      throw new Error(
        `Gagal menghapus data dari Google Sheets: ${error.message}`
      );
    }
  }

  async deleteDetailRow(idKendala: string): Promise<boolean> {
    try {
      await this.ensureSheetConfigLoaded();
      const rowIndex = await this.findDetailRowIndex(idKendala);
      if (!rowIndex) {
        throw new Error(
          `Data dengan idKendala ${idKendala} tidak ditemukan di Google Sheets`
        );
      }

      if (!this.detailSheetId) {
        throw new Error("Detail sheet tidak ditemukan");
      }

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: this.detailSheetId,
                  dimension: "ROWS",
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex,
                },
              },
            },
          ],
        },
      });

      logger.info(`Deleted detail row ${rowIndex} for idKendala: ${idKendala}`);
      return true;
    } catch (error: any) {
      logger.error("Error deleting detail row from Google Sheets:", error);
      throw new Error(
        `Gagal menghapus data dari Google Sheets: ${error.message}`
      );
    }
  }

  private mapRowToSummary(row: any[], rowNumber: number): NdeUsulanB2BRow {
    let c2r: number | null = null;
    if (row[2]) {
      const c2rStr = String(row[2]).replace(/%/g, "").replace(/,/g, "");
      const parsed = parseFloat(c2rStr);
      if (!isNaN(parsed)) {
        c2r = parsed;
      }
    }

    let nilaiKontrak: bigint | null = null;
    if (row[11]) {
      const nilaiStr = String(row[11]).replace(/,/g, "").trim();
      if (nilaiStr) {
        try {
          nilaiKontrak = BigInt(nilaiStr);
        } catch (e) {}
      }
    }

    let ihldLopId: number | null = null;
    if (row[12]) {
      const ihldStr = String(row[12]).replace(/,/g, "").trim();
      const parsed = parseInt(ihldStr, 10);
      if (!isNaN(parsed)) {
        ihldLopId = parsed;
      }
    }

    let rabHld: bigint | null = null;
    if (row[14]) {
      const rabStr = String(row[14]).replace(/,/g, "").trim();
      if (rabStr) {
        try {
          rabHld = BigInt(rabStr);
        } catch (e) {}
      }
    }

    let rabSurvey: bigint | null = null;
    if (row[15]) {
      const rabStr = String(row[15]).replace(/,/g, "").trim();
      if (rabStr) {
        try {
          rabSurvey = BigInt(rabStr);
        } catch (e) {}
      }
    }

    let jarakOdp: number | null = null;
    if (row[21]) {
      const jarakStr = String(row[21]).replace(/,/g, "").trim();
      const parsed = parseFloat(jarakStr);
      if (!isNaN(parsed)) {
        jarakOdp = parsed;
      }
    }

    return {
      no: this.normalizeNo(row[0], rowNumber - 1),
      nomorNcx: String(row[3] || "")
        .trim()
        .replace(/^'/, ""),

      statusJt: (() => {
        const v = this.normalizeEnumValue(row[1]);
        return v ? (v as any) : null;
      })(),
      c2r,
      alamatInstalasi: row[9] ? String(row[9]).trim() : null,
      jenisLayanan: row[10] ? String(row[10]).trim() : null,
      nilaiKontrak,
      rabSurvey,
      nomorNde: row[16] ? String(row[16]).trim() : null,
      progressJt: row[19] ? String(row[19]).trim() : null,
      namaOdp: row[20] ? String(row[20]).trim() : null,
      jarakOdp,
      keterangan: row[22] ? String(row[22]).trim() : null,

      datel: String(row[4] || "").trim(),
      sto: String(row[5] || "").trim(),
      namaPelanggan: row[6] ? String(row[6]).trim() : null,
      latitude: row[7] ? String(row[7]).trim() : null,
      longitude: row[8] ? String(row[8]).trim() : null,
      ihldLopId,
      planTematik: row[13] ? String(row[13]).trim() : null,
      rabHld,
      statusUsulan: row[17] ? String(row[17]).trim() : null,
      statusInstalasi: this.normalizeStatusInstalasi(row[18]) as any
    };
  }

  private mapRowToDetail(row: any[], rowNumber: number): NewBgesB2BOloRow {
    let tglInputUsulan: Date | null = null;
    if (row[3]) {
      const dateStr = String(row[3]).trim();
      if (dateStr && dateStr !== '-' && dateStr !== '') {
        try {
          if (dateStr.includes("/")) {
            const parts = dateStr.split("/");
            if (parts.length === 3) {
              const month = parts[0] ? parseInt(parts[0], 10) : 1;
              const day = parts[1] ? parseInt(parts[1], 10) : 1;
              let year = parts[2] ? parseInt(parts[2], 10) : new Date().getFullYear();
              
              // Handle 2-digit year (e.g., 24 -> 2024)
              if (year < 100) {
                year += year < 50 ? 2000 : 1900;
              }
              
              // PERBAIKAN: Parse sebagai UTC untuk menghindari timezone shift
              // Format: YYYY-MM-DD akan di-parse sebagai UTC midnight
              const isoDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;
              tglInputUsulan = new Date(isoDateStr);
              
              // Validate the date is reasonable
              if (isNaN(tglInputUsulan.getTime()) || year < 2000 || year > 2100) {
                console.warn(`Invalid date parsed from "${dateStr}" at row ${rowNumber}: ${tglInputUsulan}`);
                tglInputUsulan = null;
              }
            } else {
              tglInputUsulan = new Date(dateStr);
              if (isNaN(tglInputUsulan.getTime())) tglInputUsulan = null;
            }
          } else {
            // Try parsing as ISO date or other format
            tglInputUsulan = new Date(dateStr);
            if (isNaN(tglInputUsulan.getTime())) tglInputUsulan = null;
          }
        } catch (error) {
          console.warn(`Failed to parse date "${dateStr}" at row ${rowNumber}:`, error);
          tglInputUsulan = null;
        }
      }
    }

    let umur: number | null = null;
    if (row[1]) {
      const umurStr = String(row[1]).replace(/,/g, "").trim();
      const parsed = parseInt(umurStr, 10);
      if (!isNaN(parsed)) {
        umur = parsed;
      }
    }

    let rabHld: bigint | null = null;
    if (row[13]) {
      const rabStr = String(row[13]).replace(/,/g, "").trim();
      if (rabStr) {
        try {
          rabHld = BigInt(rabStr);
        } catch (e) {}
      }
    }

    let ihldValue: bigint | null = null;
    if (row[14]) {
      const ihldStr = String(row[14]).replace(/,/g, "").trim();
      if (ihldStr) {
        try {
          ihldValue = BigInt(ihldStr);
        } catch (e) {}
      }
    }

    let occPercentage: number | null = null;

    return {
      idKendala: String(row[4] || "").trim(),
      umur,
      bln: row[2] ? String(row[2]).trim() : null,
      tglInputUsulan,
      jenisOrder: row[5] ? String(row[5]).trim() : null,

      datel: String(row[6] || "").trim(),
      sto: String(row[7] || "").trim(),
      namaPelanggan: row[8] ? String(row[8]).trim() : null,
      latitude: row[9] ? String(row[9]).trim() : null,
      longitude: row[10] ? String(row[10]).trim() : null,

      jenisKendala: (this.normalizeEnumValue(row[11]) as any) ?? null,
      planTematik: (this.normalizeEnumValue(row[12]) as any) ?? null,

      rabHld,
      ihldValue,

      statusUsulan: (this.normalizeEnumValue(row[15]) as any) ?? null,
      statusIhld: row[16] ? String(row[16]).trim() : null,
      idEprop: row[17] ? String(row[17]).trim() : null,
      statusInstalasi: this.normalizeStatusInstalasi(row[18]) as any,
      keterangan: (this.normalizeEnumValue(row[19]) as any) ?? null,
      newSc: row[20] ? String(row[20]).trim() : null,

      namaOdp: null,
      tglGolive: null,

      avai: null,
      used: null,
      isTotal: null,
      occPercentage,
    };
  }

  private mapSummaryToRow(data: Partial<NdeUsulanB2BRow>): any[] {
    return [
      data.no || "",
      this.denormalizeEnumValue(data.statusJt),
      data.c2r?.toString() || "0",
      data.nomorNcx || "",
      data.datel || "",
      data.sto || "",
      data.namaPelanggan || "",
      data.latitude || "",
      data.longitude || "",
      data.alamatInstalasi || "",
      data.jenisLayanan || "",
      data.nilaiKontrak?.toString() || "0",
      data.ihldLopId?.toString() || "0",
      this.denormalizeEnumValue(data.planTematik),
      data.rabHld?.toString() || "0",
      data.rabSurvey?.toString() || "0",
      data.nomorNde || "",
      this.denormalizeEnumValue(data.statusUsulan),
      this.denormalizeEnumValue(data.statusInstalasi),
      data.progressJt || "",
      data.namaOdp || "",
      data.jarakOdp?.toString() || "0",
      this.denormalizeEnumValue(data.keterangan),
    ];
  }

  private mapDetailToRow(data: Partial<NewBgesB2BOloRow>): any[] {
    // Helper to format date as m/d/yyyy without timezone shift
    const formatDate = (date: Date | null | undefined): string => {
      if (!date) return "";
      const d = new Date(date);
      // Use UTC components to avoid timezone shift
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();
      const year = d.getUTCFullYear();
      return `${month}/${day}/${year}`;
    };
    
    return [
      "",
      data.umur?.toString() || "",
      data.bln || "",
      formatDate(data.tglInputUsulan),
      data.idKendala || "",
      data.jenisOrder || "",
      data.datel || "",
      data.sto || "",
      data.namaPelanggan || "",
      data.latitude || "",
      data.longitude || "",
      this.denormalizeEnumValue(data.jenisKendala),
      this.denormalizeEnumValue(data.planTematik),
      data.rabHld?.toString() || "0",
      data.ihldValue?.toString() || "0",
      this.denormalizeEnumValue(data.statusUsulan),
      data.statusIhld || "",
      data.idEprop || "",
      this.denormalizeEnumValue(data.statusInstalasi),
      this.denormalizeEnumValue(data.keterangan),
      data.newSc || "",
    ];
  }
}
