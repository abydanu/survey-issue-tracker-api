import fs from "fs/promises";
import path from "path";
import prisma from "../../../infrastructure/database/prisma.js";
import logger from "../../../infrastructure/logging/logger.js";
import { GoogleSheetsService } from "../infrastructure/google-sheets.service.js";

type EnumName =
  | "StatusJt"
  | "StatusInstalasi"
  | "JenisKendala"
  | "PlanTematik"
  | "StatusUsulan"
  | "Keterangan";

type EnumSource = {
  enumName: EnumName;
  sheet: "summary" | "detail";
  columnIndex: number;
  normalize: (input: unknown) => string | null;
};

export type EnumSyncResult = {
  enumName: EnumName;
  sheetValues: string[];
  dbValues: string[];
  schemaValues: string[];
  toAddDb: string[];
  toAddSchema: string[];
};

const PRISMA_SCHEMA_PATH = path.resolve("src/core/prisma/schema.prisma");

export class EnumSyncService {
  private readonly schemaPath: string;
  private readonly googleSheets: GoogleSheetsService;

  private readonly enumSources: EnumSource[] = [
    {
      enumName: "StatusJt",
      sheet: "summary",
      columnIndex: 1,
      normalize: (v) => this.normalizeEnumValue(v),
    },
    {
      enumName: "StatusInstalasi",
      sheet: "summary",
      columnIndex: 18,
      normalize: (v) => this.normalizeStatusInstalasi(v),
    },
    {
      enumName: "StatusInstalasi",
      sheet: "detail",
      columnIndex: 18,
      normalize: (v) => this.normalizeStatusInstalasi(v),
    },
    {
      enumName: "JenisKendala",
      sheet: "detail",
      columnIndex: 11,
      normalize: (v) => this.normalizeEnumValue(v),
    },
    {
      enumName: "PlanTematik",
      sheet: "detail",
      columnIndex: 12,
      normalize: (v) => this.normalizeEnumValue(v),
    },
    {
      enumName: "StatusUsulan",
      sheet: "summary",
      columnIndex: 17,
      normalize: (v) => this.normalizeEnumValue(v),
    },
    {
      enumName: "StatusUsulan",
      sheet: "detail",
      columnIndex: 15,
      normalize: (v) => this.normalizeEnumValue(v),
    },
    {
      enumName: "Keterangan",
      sheet: "detail",
      columnIndex: 19,
      normalize: (v) => this.normalizeEnumValue(v),
    },
  ];

  constructor(googleSheets?: GoogleSheetsService, schemaPath = PRISMA_SCHEMA_PATH) {
    this.googleSheets = googleSheets ?? new GoogleSheetsService();
    this.schemaPath = schemaPath;
  }

  async syncEnums(options: { dryRun?: boolean } = {}): Promise<{
    dryRun: boolean;
    changes: EnumSyncResult[];
    schemaUpdated: boolean;
    dbUpdated: boolean;
    message: string;
  }> {
    const dryRun = options.dryRun ?? true;

    const sheetValuesMap = await this.collectSheetEnumValues();
    const enumNames = Array.from(
      new Set(this.enumSources.map((source) => source.enumName))
    ) as EnumName[];

    const schemaContent = await fs.readFile(this.schemaPath, "utf-8");
    let updatedSchemaContent = schemaContent;
    let schemaUpdated = false;
    let dbUpdated = false;

    const changes: EnumSyncResult[] = [];

    for (const enumName of enumNames) {
      const sheetValues = Array.from(sheetValuesMap.get(enumName) ?? []).sort();
      const dbValues = Array.from(await this.getDbEnumValues(enumName)).sort();
      const schemaValues = Array.from(
        await this.getSchemaEnumValues(enumName, schemaContent)
      ).sort();

      const toAddDb = sheetValues.filter((v) => !dbValues.includes(v));
      const toAddSchema = sheetValues.filter(
        (v) => !schemaValues.includes(v)
      );

      if (!dryRun) {
        for (const value of toAddDb) {
          await this.addEnumValueToDatabase(enumName, value);
          dbUpdated = true;
        }
        if (toAddSchema.length > 0) {
            updatedSchemaContent = this.applySchemaUpdates(
              enumName,
              new Set([...schemaValues, ...toAddSchema]),
              updatedSchemaContent
            );
            schemaUpdated = true;
          }
        }
  
        changes.push({
          enumName,
          sheetValues,
          dbValues,
          schemaValues,
          toAddDb,
          toAddSchema,
        });
      }
  
      if (!dryRun && schemaUpdated) {
        await fs.writeFile(this.schemaPath, updatedSchemaContent, "utf-8");
        logger.info(
          { schemaPath: this.schemaPath },
          "Updated Prisma schema enums with new values"
        );
      }
  
      const message = dryRun
        ? "Dry run completed"
        : dbUpdated || schemaUpdated
        ? "Enum sync completed"
        : "No enum changes required";
  
      return { dryRun, changes, schemaUpdated, dbUpdated, message };
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
          REVIEW: "REVIEW",
          SURVEY: "SURVEY",
          INSTALASI: "INSTALASI",
          "DONE INSTALASI": "DONE_INSTALASI",
          GOLIVE: "GO_LIVE",
          "GO LIVE": "GO_LIVE",
          CANCEL: "CANCEL",
          PENDING: "PENDING",
          KENDALA: "KENDALA",
          "WAITING BUDGET": "WAITING_BUDGET",
          DROP: "DROP",
          "WAITING PROJECT JPP": "WAITING_PROJECT_JPP",
          "WAITING CB": "WAITING_CB",
        };
    
        return mappings[cleaned] ?? this.normalizeEnumValue(cleaned);
      }

      private async collectSheetEnumValues(): Promise<Map<EnumName, Set<string>>> {
        const summaryRows = await this.googleSheets.readRawSummaryRows();
        const detailRows = await this.googleSheets.readRawDetailRows();
        const result = new Map<EnumName, Set<string>>();
    
        for (const source of this.enumSources) {
          const rows = source.sheet === "summary" ? summaryRows : detailRows;
          for (const row of rows) {
            if (!Array.isArray(row)) continue;
            const rawValue = row[source.columnIndex];
            const normalized = source.normalize(rawValue);
            if (!normalized) continue;
    
            if (!result.has(source.enumName)) {
              result.set(source.enumName, new Set<string>());
            }
            result.get(source.enumName)!.add(normalized);
          }
        }
    
        return result;
      }
    
      private async getDbEnumValues(enumName: EnumName): Promise<Set<string>> {
        const rows = await prisma.$queryRaw<
          { enumlabel: string; typname: string }[]
        >`
          SELECT e.enumlabel, t.typname
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = ${enumName} OR t.typname = lower(${enumName})
          ORDER BY e.enumsortorder;
        `;
    
        return new Set(rows.map((row) => row.enumlabel));
      }

      private async getSchemaEnumValues(
        enumName: EnumName,
        schemaContent: string
      ): Promise<Set<string>> {
        const regex = new RegExp(`enum\\s+${enumName}\\s*{([^}]*)}`, "m");
        const match = schemaContent.match(regex);

        if (!match || !match[1]) return new Set();
    
        const body = match[1];
        const values = body
          .split("\n")
          .map((line) => line.replace(/\/\/.*$/, "").trim())
          .filter((line) => line.length > 0);
    
        return new Set(values);
      }
    
      private applySchemaUpdates(
        enumName: EnumName,
        values: Set<string>,
        schemaContent: string
      ): string {
        const regex = new RegExp(`enum\\s+${enumName}\\s*{[^}]*}`, "m");
        const sortedValues = Array.from(values).sort();
        const newBlock = `enum ${enumName} {\n${sortedValues
          .map((v) => `  ${v}`)
          .join("\n")}\n}`;
    
        if (regex.test(schemaContent)) {
          return schemaContent.replace(regex, newBlock);
        }
    
        logger.warn(
          { enumName },
          "Enum not found in schema when applying updates. No changes applied."
        );
        return schemaContent;
      }
    
      private async addEnumValueToDatabase(
        enumName: EnumName,
        value: string
      ): Promise<void> {
        const sanitizedValue = value.replace(/'/g, "''");
        await prisma.$executeRawUnsafe(
          `ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${sanitizedValue}'`
        );
      }
    }
    