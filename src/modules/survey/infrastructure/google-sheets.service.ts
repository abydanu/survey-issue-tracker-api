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

  const base64Json = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64?.trim();
  if (base64Json) {
    try {
      const decoded = Buffer.from(base64Json, 'base64').toString('utf-8');
      const credentials = JSON.parse(decoded) as Record<string, unknown>;

      if (typeof credentials.private_key === "string") {
        credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
      }

      return credentials;
    } catch (error) {
      throw new Error(`Failed to decode GOOGLE_SERVICE_ACCOUNT_BASE64: ${error}`);
    }
  }


  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (rawJson) {
    try {
      const credentials = JSON.parse(rawJson) as Record<string, unknown>;

      if (typeof credentials.private_key === "string") {
        credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
      }

      return credentials;
    } catch (parseError) {

      if (fs.existsSync(rawJson)) {
        return JSON.parse(fs.readFileSync(rawJson, "utf-8")) as Record<
          string,
          unknown
        >;
      }
      throw new Error(`Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: ${parseError}`);
    }
  }


  const path = process.env.GOOGLE_SERVICE_ACCOUNT_PATH?.trim();

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
    "Set GOOGLE_SERVICE_ACCOUNT_BASE64 (base64 encoded), GOOGLE_SERVICE_ACCOUNT_JSON (raw JSON), atau GOOGLE_SERVICE_ACCOUNT_PATH (file path)."
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


    this.loadEnumMappingFromDatabase().catch(() => {

    });
  }

  private async ensureSheetConfigLoaded(): Promise<void> {
    if (this.summarySheetId !== null && this.detailSheetId !== null) return;

    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });

    const sheets = spreadsheet.data.sheets || [];
    const titles = sheets.map((s: any) => s.properties?.title).filter(Boolean);

    
    const summarySheet = sheets.find(
      (s: any) => s.properties?.title === this.summarySheetName
    );
    const detailSheet = sheets.find(
      (s: any) => s.properties?.title === this.detailSheetName
    );

    if (!summarySheet || !detailSheet) {
      logger.warn(
        `Sheet name mismatch. Config summary='${this.summarySheetName
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
  }

  async readSummaryData(): Promise<SurveySummarySheetRow[]> {
    try {
      await this.ensureSheetConfigLoaded();
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.summarySheetName}!A:W`,
        valueRenderOption: 'FORMATTED_VALUE',
      });

      const rows = response.data.values;
      if (!rows || rows.length < 3) {
        return [];
      }

      const findHeaderRowIndex = (allRows: any[][]): number => {
        
        for (let i = 0; i < allRows.length; i++) {
          const row = allRows[i];
          if (!Array.isArray(row)) continue;
          const a = String(row[0] ?? "").trim().toUpperCase();
          const d = String(row[3] ?? "").trim().toUpperCase();
          if (a === "NO" && (d.includes("NCX") || d.includes("STARCLICK"))) {
            return i;
          }
        }
        return -1;
      };

      const headerIdx = findHeaderRowIndex(rows as any[][]);
      const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows.slice(2);

      const results = [];
      let skippedEmptyRow = 0;
      let skippedNoNomorNcx = 0;
      let skippedShortRow = 0;

      for (const [index, row] of dataRows.entries()) {
        if (!Array.isArray(row) || row.length === 0) {
          skippedEmptyRow++;
          continue;
        }
        if (
          Array.isArray(row) &&
          row.length >= 4
        ) {
          const nomorNcxCell = String(row[3] ?? "").trim();
          if (nomorNcxCell !== "") {
            
            const rowNumber =
              headerIdx >= 0 ? headerIdx + 1 + (index + 1) : 2 + (index + 1);
            results.push(await this.mapRowToSummary(row, rowNumber));
          } else {
            skippedNoNomorNcx++;
          }
        } else {
          skippedShortRow++;
        }
      }

      logger.info(
        {
          totalRows: rows.length,
          headerIdx,
          dataRows: dataRows.length,
          returned: results.length,
          skippedEmptyRow,
          skippedShortRow,
          skippedNoNomorNcx,
        },
        "Read summary data completed"
      );
      return results;
    } catch (error: any) {
      logger.error({
        message: error.message,
        stack: error.stack
      }, "Error reading summary data from Google Sheets");
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
    const findHeaderRowIndex = (allRows: any[][]): number => {
      
      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        if (!Array.isArray(row)) continue;
        const joined = row.map((c) => String(c ?? "").trim().toUpperCase()).join(" | ");
        const score =
          (joined.includes("ID KENDALA") || joined.includes("KENDALA") ? 1 : 0) +
          (joined.includes("DATEL") ? 1 : 0) +
          (joined.includes("STO") ? 1 : 0) +
          (joined.includes("NAMA PELANGGAN") ? 1 : 0) +
          (joined.includes("NEW SC") ? 1 : 0);
        if (score >= 3) return i;
      }
      return -1;
    };
    const headerIdx = findHeaderRowIndex(rows as any[][]);
    return headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows.slice(2);
  }

  async readRawSummaryRows(): Promise<any[][]> {
    await this.ensureSheetConfigLoaded();
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.summarySheetName}!A:W`,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const rows = response.data.values;
    if (!rows || rows.length < 3) return [];
    const findHeaderRowIndex = (allRows: any[][]): number => {
      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        if (!Array.isArray(row)) continue;
        const a = String(row[0] ?? "").trim().toUpperCase();
        const d = String(row[3] ?? "").trim().toUpperCase();
        if (a === "NO" && (d.includes("NCX") || d.includes("STARCLICK"))) return i;
      }
      return -1;
    };
    const headerIdx = findHeaderRowIndex(rows as any[][]);
    return headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows.slice(2);
  }

  async readDataValidationValues(sheetName: string, column: string): Promise<string[]> {
    try {
      await this.ensureSheetConfigLoaded();
      
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        ranges: [`${sheetName}!${column}:${column}`],
        includeGridData: true,
      });

      const sheets = response.data.sheets || [];
      const values = new Set<string>();

      for (const sheet of sheets) {
        const data = sheet.data || [];
        for (const gridData of data) {
          const rowData = gridData.rowData || [];
          
          for (const row of rowData) {
            const cells = row.values || [];
            if (cells.length > 0 && cells[0].dataValidation) {
              const validation = cells[0].dataValidation;
              
              
              if (validation.condition?.type === 'ONE_OF_LIST') {
                const listValues = validation.condition.values || [];
                for (const v of listValues) {
                  const val = v.userEnteredValue || '';
                  if (val) values.add(String(val));
                }
              }
              
              
              if (validation.condition?.type === 'ONE_OF_RANGE') {
                const rangeValues = validation.condition.values || [];
                for (const v of rangeValues) {
                  if (v.userEnteredValue) {
                    
                    const formula = String(v.userEnteredValue);
                    
                    const rangeMatch = formula.match(/=(.+)!(.+)/);
                    if (rangeMatch) {
                      const [, refSheet, refRange] = rangeMatch;
                      try {
                        const refResponse = await this.sheets.spreadsheets.values.get({
                          spreadsheetId: this.spreadsheetId,
                          range: `${refSheet}!${refRange}`,
                        });
                        const refRows = refResponse.data.values || [];
                        for (const refRow of refRows) {
                          if (Array.isArray(refRow) && refRow[0]) {
                            values.add(String(refRow[0]).trim());
                          }
                        }
                      } catch (e) {
                        logger.warn(`Failed to read validation range: ${formula}`);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      return Array.from(values).filter(v => v && v !== '');
    } catch (error: any) {
      logger.warn(`Failed to read data validation for ${sheetName}!${column}: ${error.message}`);
      return [];
    }
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

      const findHeaderRowIndex = (allRows: any[][]): number => {
        for (let i = 0; i < allRows.length; i++) {
          const row = allRows[i];
          if (!Array.isArray(row)) continue;
          const joined = row.map((c) => String(c ?? "").trim().toUpperCase()).join(" | ");
          const score =
            (joined.includes("ID KENDALA") || joined.includes("KENDALA") ? 1 : 0) +
            (joined.includes("DATEL") ? 1 : 0) +
            (joined.includes("STO") ? 1 : 0) +
            (joined.includes("NAMA PELANGGAN") ? 1 : 0) +
            (joined.includes("NEW SC") ? 1 : 0);
          if (score >= 3) return i;
        }
        return -1;
      };
      const headerIdx = findHeaderRowIndex(rows as any[][]);
      const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows.slice(2);

      const results = [];
      let skippedCount = 0;
      const skipReasons: { [key: string]: number } = {
        'empty_row': 0,
        'no_idKendala': 0,
        'idKendala_dash': 0,
      };

      for (const [index, row] of dataRows.entries()) {
        const rowNumber = index + 3;

        if (!Array.isArray(row) || row.length === 0) {
          skipReasons['empty_row'] = (skipReasons['empty_row'] || 0) + 1;
          skippedCount++;
          continue;
        }

        const idKendala = row[4] ? String(row[4]).trim() : '';
        const namaPelanggan = row[8] ? String(row[8]).trim() : 'N/A';

        if (!idKendala || idKendala === '') {
          skipReasons['no_idKendala'] = (skipReasons['no_idKendala'] || 0) + 1;
          skippedCount++;
          continue;
        }

        if (idKendala === '-') {
          skipReasons['idKendala_dash'] = (skipReasons['idKendala_dash'] || 0) + 1;
          skippedCount++;
          continue;
        }

        results.push(await this.mapRowToDetail(row, rowNumber));
      }

      console.log(`[DEBUG] Detail records processed: ${results.length}, skipped: ${skippedCount}`);
      console.log(`[DEBUG] Skip reasons:`, skipReasons);

      return results;
    } catch (error: any) {
      logger.error({
        message: error.message,
        stack: error.stack
      }, "Error reading detail data from Google Sheets");
      throw new Error(
        `Gagal membaca data dari Google Sheets: ${error.message}`
      );
    }
  }

  private async normalizeEnumValue(input: unknown, enumType?: string): Promise<string | null> {
    const raw = String(input ?? "").trim();
    if (!raw) return null;

    
    await this.loadEnumMappingFromDatabase();

    
    if (enumType && this.reverseEnumMappingCache.has(enumType)) {
      const typeMapping = this.reverseEnumMappingCache.get(enumType)!;
      if (typeMapping.has(raw)) {
        const result = typeMapping.get(raw)!;
        return result;
      }
    }

    
    
    return raw
      .toUpperCase()
      .replace(/^\d+\s*/g, "")
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  private async normalizeStatusInstalasi(input: unknown): Promise<string | null> {
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
    return mapped || await this.normalizeEnumValue(cleaned);
  }

  private async pickEnum<T extends string>(
    input: unknown,
    allowed: Set<string>
  ): Promise<T | null> {
    const norm = await this.normalizeEnumValue(input) as any;
    if (!norm) return null;
    return allowed.has(norm) ? (norm as T) : null;
  }

  private enumMappingCache: Map<string, Map<string, string>> = new Map();
  private reverseEnumMappingCache: Map<string, Map<string, string>> = new Map();
  private lastEnumCacheUpdate: number = 0;
  private readonly ENUM_CACHE_TTL = 5 * 60 * 1000;
  private isLoadingEnumCache: boolean = false;

  private async loadEnumMappingFromDatabase(): Promise<void> {
    const now = Date.now();


    if (now - this.lastEnumCacheUpdate < this.ENUM_CACHE_TTL) {
      return;
    }


    if (this.isLoadingEnumCache) {
      return;
    }

    this.isLoadingEnumCache = true;

    try {

      const { default: prisma } = await import('../../../infrastructure/database/prisma.js');

      const enumValues = await prisma.enumValue.findMany({
        where: { isActive: true },
        select: {
          enumType: true,
          value: true,
          displayName: true,
        },
      });


      this.enumMappingCache.clear();
      this.reverseEnumMappingCache.clear();


      for (const enumValue of enumValues) {
        const { enumType, value, displayName } = enumValue;


        if (!displayName) continue;


        if (!this.enumMappingCache.has(enumType)) {
          this.enumMappingCache.set(enumType, new Map());
        }
        this.enumMappingCache.get(enumType)!.set(value, displayName);


        if (!this.reverseEnumMappingCache.has(enumType)) {
          this.reverseEnumMappingCache.set(enumType, new Map());
        }
        this.reverseEnumMappingCache.get(enumType)!.set(displayName, value);
      }

      this.lastEnumCacheUpdate = now;
    } catch (error: any) {
      logger.error({
        message: error.message,
        stack: error.stack,
        name: error.name
      }, 'Failed to load enum mapping from database');
    } finally {
      this.isLoadingEnumCache = false;
    }
  }

  private async denormalizeEnumValue(input: string | null | undefined, enumType?: string): Promise<string> {
    if (!input) return "";

    const value = String(input).trim();


    await this.loadEnumMappingFromDatabase();


    if (enumType && this.enumMappingCache.has(enumType)) {
      const typeMapping = this.enumMappingCache.get(enumType)!;
      if (typeMapping.has(value)) {
        return typeMapping.get(value)!;
      }

      const upperValue = value.toUpperCase();
      for (const [key, val] of typeMapping.entries()) {
        if (key.toUpperCase() === upperValue) {
          return val;
        }
      }
    }


    const staticMapping: Record<string, string> = {};

    if (staticMapping[value]) {
      return staticMapping[value];
    }

    const upperValue = value.toUpperCase();
    if (staticMapping[upperValue]) {
      return staticMapping[upperValue];
    }


    return value.replace(/_/g, " ").trim();
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
      
      
      const dataRows = rows.length < 2 ? [] : rows.slice(1);

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

      return idx >= 0 ? idx + 2 : null; 
    } catch (error: any) {
      logger.error({
        message: error.message,
        stack: error.stack
      }, "Error finding summary row index");
      return null;
    }
  }

  private async findSummaryRowIndexByNomorNcx(nomorNcx: string): Promise<number | null> {
    try {
      await this.ensureSheetConfigLoaded();
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.summarySheetName}!D:D`,
      });

      const rows = response.data.values || [];
      const dataRows = rows.length < 2 ? [] : rows.slice(1); 

      const idx = dataRows.findIndex((row: any[]) => {
        const cellValue = String(row[0] ?? "").trim();
        return cellValue === String(nomorNcx).trim();
      });

      return idx >= 0 ? idx + 2 : null; 
    } catch (error: any) {
      logger.error({
        message: error.message,
        stack: error.stack
      }, "Error finding summary row index by nomorNcx");
      return null;
    }
  }

  private async findSummaryRowIndexByCustomerName(namaPelanggan: string): Promise<number | null> {
    try {
      await this.ensureSheetConfigLoaded();
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.summarySheetName}!G:G`,
      });

      const rows = response.data.values || [];
      const dataRows = rows.length < 2 ? [] : rows.slice(1); 

      const searchName = String(namaPelanggan).trim().toLowerCase();
      const idx = dataRows.findIndex((row: any[]) => {
        const cellValue = String(row[0] ?? "").trim().toLowerCase();
        return cellValue === searchName;
      });

      return idx >= 0 ? idx + 2 : null; 
    } catch (error: any) {
      logger.error({
        message: error.message,
        stack: error.stack
      }, "Error finding summary row index by customer name");
      return null;
    }
  }

  private async findDetailRowIndex(idKendala: string): Promise<number | null> {
    try {
      await this.ensureSheetConfigLoaded();

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.detailSheetName}!E:E`,
      });

      const rows = response.data.values || [];

      const dataRows = rows.length < 3 ? [] : rows.slice(2);
      const k = String(idKendala).trim();
      const idx = dataRows.findIndex(
        (row: any[]) => String(row[0] ?? "").trim() === k
      );

      return idx >= 0 ? idx + 3 : null;
    } catch (error: any) {
      logger.error({
        message: error.message,
        stack: error.stack,
        idKendala
      }, "Error finding detail row index");
      return null;
    }
  }

  async updateSummaryRow(
    data: Partial<SurveySummarySheetRow>
  ): Promise<boolean> {
    try {
      await this.ensureSheetConfigLoaded();
      if (!data.no && !data.nomorNcx) {
        throw new Error('Field "no" atau "nomorNcx" diperlukan untuk update');
      }

      let rowIndex: number | null = null;


      if (data.no) {
        logger.info(`Searching for summary row with no: ${data.no}`);
        rowIndex = await this.findSummaryRowIndex(data.no);
      }


      if (!rowIndex && data.nomorNcx) {
        logger.info(`Row not found by no, searching by nomorNcx: ${data.nomorNcx}`);
        rowIndex = await this.findSummaryRowIndexByNomorNcx(data.nomorNcx);
      }


      if (!rowIndex && data.namaPelanggan) {
        logger.info(`Row not found by no/nomorNcx, searching by namaPelanggan: ${data.namaPelanggan}`);
        rowIndex = await this.findSummaryRowIndexByCustomerName(data.namaPelanggan);
      }

      if (!rowIndex) {
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${this.summarySheetName}!A:D`,
        });
        const rows = response.data.values || [];
        const dataRows = rows.length < 2 ? [] : rows.slice(1); 
        const availableNos = dataRows
          .map((row: any[]) => String(row[0] ?? "").trim())
          .filter(Boolean);
        const availableNcx = dataRows
          .map((row: any[]) => String(row[3] ?? "").trim())
          .filter(Boolean);

        logger.error(
          `Data tidak ditemukan di Google Sheets. ` +
          `Searched no: ${data.no}, nomorNcx: ${data.nomorNcx}. ` +
          `Available nos: ${availableNos.slice(0, 5).join(", ")}${availableNos.length > 5 ? "..." : ""}. ` +
          `Available nomorNcx: ${availableNcx.slice(0, 5).join(", ")}${availableNcx.length > 5 ? "..." : ""}`
        );
        throw new Error(
          `Data dengan no ${data.no} atau nomorNcx ${data.nomorNcx} tidak ditemukan di Google Sheets`
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

      if (data.statusJt !== undefined) {
        const value = await this.denormalizeEnumValue(data.statusJt, 'StatusJt');
        setCell("B", value);
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
      if (data.keterangan !== undefined) {
        const value = await this.denormalizeEnumValue(data.keterangan as any, 'Keterangan');
        setCell("W", value);
      }

      if (updates.length === 0) {
        logger.info(
          `No editable fields provided, skip updating summary row ${rowIndex}`
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

      logger.info(`Updated summary row ${rowIndex} (no: ${data.no}, nomorNcx: ${data.nomorNcx})`);
      return true;
    } catch (error: any) {
      logger.error({
        message: error.message,
        stack: error.stack,
        no: data.no,
        nomorNcx: data.nomorNcx
      }, "Error updating summary row in Google Sheets");
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

      const fullRow = await this.mapDetailToRow(data);

      const rowDataToUpdate = fullRow.slice(1);

      const updateRange = `'${this.detailSheetName}'!B${rowIndex}:U${rowIndex}`;
      logger.info(`[DEBUG] Updating range: ${updateRange}`);


      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: updateRange,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [rowDataToUpdate],
        },
      });


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
      logger.error({
        message: error.message,
        stack: error.stack,
        idKendala: data.idKendala
      }, "Error updating detail row in Google Sheets");
      throw new Error(
        `Gagal mengupdate data di Google Sheets: ${error.message}`
      );
    }
  }

  async appendSummaryRow(data: SurveySummarySheetRow): Promise<boolean> {
    try {
      await this.ensureSheetConfigLoaded();
      const row = await this.mapSummaryToRow(data);
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
      logger.error({
        message: error.message,
        stack: error.stack,
        no: data.no
      }, "Error appending summary row to Google Sheets");
      throw new Error(
        `Gagal menambahkan data ke Google Sheets: ${error.message}`
      );
    }
  }

  async appendDetailRow(data: NewBgesB2BOloRow): Promise<boolean> {
    try {
      await this.ensureSheetConfigLoaded();
      const row = await this.mapDetailToRow(data);
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
      logger.error({
        message: error.message,
        stack: error.stack,
        idKendala: data.idKendala
      }, "Error appending detail row to Google Sheets");
      throw new Error(
        `Gagal menambahkan data ke Google Sheets: ${error.message}`
      );
    }
  }

  async deleteSummaryRow(no: string, nomorNcx?: string, namaPelanggan?: string): Promise<boolean> {
    try {
      await this.ensureSheetConfigLoaded();

      let rowIndex: number | null = null;


      if (no) {
        logger.info(`Searching for summary row to delete with no: ${no}`);
        rowIndex = await this.findSummaryRowIndex(no);
      }


      if (!rowIndex && nomorNcx) {
        logger.info(`Row not found by no, searching by nomorNcx: ${nomorNcx}`);
        rowIndex = await this.findSummaryRowIndexByNomorNcx(nomorNcx);
      }


      if (!rowIndex && namaPelanggan) {
        logger.info(`Row not found by no/nomorNcx, searching by namaPelanggan: ${namaPelanggan}`);
        rowIndex = await this.findSummaryRowIndexByCustomerName(namaPelanggan);
      }

      if (!rowIndex) {
        throw new Error(
          `Data dengan no ${no}${nomorNcx ? ` atau nomorNcx ${nomorNcx}` : ''}${namaPelanggan ? ` atau nama ${namaPelanggan}` : ''} tidak ditemukan di Google Sheets`
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

      logger.info(`Deleted summary row ${rowIndex} (no: ${no}, nomorNcx: ${nomorNcx})`);
      return true;
    } catch (error: any) {
      logger.error({
        message: error.message,
        stack: error.stack,
        no,
        nomorNcx
      }, "Error deleting summary row from Google Sheets");
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
      logger.error({
        message: error.message,
        stack: error.stack,
        idKendala
      }, "Error deleting detail row from Google Sheets");
      throw new Error(
        `Gagal menghapus data dari Google Sheets: ${error.message}`
      );
    }
  }

  private async mapRowToSummary(row: any[], rowNumber: number): Promise<NdeUsulanB2BRow> {
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
        } catch (e) { }
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
        } catch (e) { }
      }
    }

    let rabSurvey: bigint | null = null;
    if (row[15]) {
      const rabStr = String(row[15]).replace(/,/g, "").trim();
      if (rabStr) {
        try {
          rabSurvey = BigInt(rabStr);
        } catch (e) { }
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
      no: this.normalizeNo(row[0], rowNumber),
      nomorNcx: String(row[3] || "")
        .trim()
        .replace(/^'/, ""),

      statusJt: await this.normalizeEnumValue(row[1], 'StatusJt') as any,
      statusJtRaw: (() => {
        const rawValue = row[1];
        const trimmedValue = rawValue ? String(rawValue).trim() : undefined;
        return trimmedValue;
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
      statusInstalasi: await this.normalizeStatusInstalasi(row[18]) as any,
      statusInstalasiRaw: row[18] ? String(row[18]).trim() : undefined,
    };
  }

  private async mapRowToDetail(row: any[], rowNumber: number): Promise<NewBgesB2BOloRow> {
    const normalizeSheetId = (value: any): string => {
      const raw = String(value || "")
        .trim()
        .replace(/^'/, ""); 

      
      
      if (/^\d+\.0$/.test(raw)) return raw.slice(0, -2);
      return raw;
    };

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


              if (year < 100) {
                year += year < 50 ? 2000 : 1900;
              }

              const isoDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;
              tglInputUsulan = new Date(isoDateStr);


              if (isNaN(tglInputUsulan.getTime()) || year < 2000 || year > 2100) {
                console.warn(`Invalid date parsed from "${dateStr}" at row ${rowNumber}: ${tglInputUsulan}`);
                tglInputUsulan = null;
              }
            } else {
              tglInputUsulan = new Date(dateStr);
              if (isNaN(tglInputUsulan.getTime())) tglInputUsulan = null;
            }
          } else {

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


    if (!tglInputUsulan && row[4] && String(row[4]).trim()) {
      console.warn(`[WARNING] Row ${rowNumber} - idKendala: ${String(row[4]).trim()} has NULL tanggal input. Raw value: "${row[3]}"`);
    }

    let rabHld: bigint | null = null;
    if (row[13]) {
      const rabStr = String(row[13]).replace(/,/g, "").trim();
      if (rabStr) {
        try {
          rabHld = BigInt(rabStr);
        } catch (e) { }
      }
    }

    let ihldValue: bigint | null = null;
    if (row[14]) {
      const ihldStr = String(row[14]).replace(/,/g, "").trim();
      if (ihldStr) {
        try {
          ihldValue = BigInt(ihldStr);
        } catch (e) { }
      }
    }

    let occPercentage: number | null = null;

    return {
      idKendala: normalizeSheetId(row[4]),
      umur,
      bln: row[2] ? String(row[2]).trim() : null,
      tglInputUsulan,
      jenisOrder: row[5] ? String(row[5]).trim() : null,

      datel: String(row[6] || "").trim(),
      sto: String(row[7] || "").trim(),
      namaPelanggan: row[8] ? String(row[8]).trim() : null,
      latitude: row[9] ? String(row[9]).trim() : null,
      longitude: row[10] ? String(row[10]).trim() : null,

      jenisKendala: await this.normalizeEnumValue(row[11], 'JenisKendala') as any,
      planTematik: await this.normalizeEnumValue(row[12], 'PlanTematik') as any,
      jenisKendalaRaw: row[11] ? String(row[11]).trim() : undefined,
      planTematikRaw: row[12] ? String(row[12]).trim() : undefined,

      rabHld,
      ihldValue,

      statusUsulan: await this.normalizeEnumValue(row[15], 'StatusUsulan') as any,
      statusIhld: row[16] ? String(row[16]).trim() : null,
      idEprop: row[17] ? String(row[17]).trim() : null,
      statusInstalasi: await this.normalizeStatusInstalasi(row[18]) as any,
      keterangan: await this.normalizeEnumValue(row[19], 'Keterangan') as any,
      statusUsulanRaw: row[15] ? String(row[15]).trim() : undefined,
      statusInstalasiRaw: row[18] ? String(row[18]).trim() : undefined,
      keteranganRaw: row[19] ? String(row[19]).trim() : undefined,
      newSc: row[20] ? normalizeSheetId(row[20]) : null,

      namaOdp: null,
      tglGolive: null,

      avai: null,
      used: null,
      isTotal: null,
      occPercentage,
    };
  }

  private async mapSummaryToRow(data: Partial<NdeUsulanB2BRow>): Promise<any[]> {

    const c2rValue = data.c2r !== null && data.c2r !== undefined
      ? `${(Number(data.c2r) * 100).toFixed(0)}%`
      : "0";

    return [
      data.no || "",
      await this.denormalizeEnumValue(data.statusJt, 'StatusJt'),
      c2rValue,
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
      await this.denormalizeEnumValue(data.planTematik, 'PlanTematik'),
      data.rabHld?.toString() || "0",
      data.rabSurvey?.toString() || "0",
      data.nomorNde || "",
      await this.denormalizeEnumValue(data.statusUsulan, 'StatusUsulan'),
      await this.denormalizeEnumValue(data.statusInstalasi, 'StatusInstalasi'),
      data.progressJt || "",
      data.namaOdp || "",
      data.jarakOdp?.toString() || "0",
      await this.denormalizeEnumValue(data.keterangan, 'Keterangan'),
    ];
  }

  private async mapDetailToRow(data: Partial<NewBgesB2BOloRow>): Promise<any[]> {

    const formatDate = (date: Date | null | undefined): string => {
      if (!date) return "";
      const d = new Date(date);

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
      await this.denormalizeEnumValue(data.jenisKendala, 'JenisKendala'),
      await this.denormalizeEnumValue(data.planTematik, 'PlanTematik'),
      data.rabHld?.toString() || "0",
      data.ihldValue?.toString() || "0",
      await this.denormalizeEnumValue(data.statusUsulan, 'StatusUsulan'),
      data.statusIhld || "",
      data.idEprop || "",
      await this.denormalizeEnumValue(data.statusInstalasi, 'StatusInstalasi'),
      await this.denormalizeEnumValue(data.keterangan, 'Keterangan'),
      data.newSc || "",
    ];
  }
}
