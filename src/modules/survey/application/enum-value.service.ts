import prisma from "../../../infrastructure/database/prisma.js";
import logger from "../../../infrastructure/logging/logger.js";
import { GoogleSheetsService } from "../infrastructure/google-sheets.service.js";

export type EnumType = 
  | "StatusJt"
  | "StatusInstalasi" 
  | "JenisKendala"
  | "PlanTematik"
  | "StatusUsulan"
  | "Keterangan";

export type EnumSource = {
  enumType: EnumType;
  sheet: "summary" | "detail";
  columnIndex: number;
  normalize: (input: unknown) => string | null;
};

export class EnumValueService {
  private readonly googleSheets: GoogleSheetsService;

  private readonly enumSources: EnumSource[] = [
    {
      enumType: "StatusJt",
      sheet: "summary",
      columnIndex: 1,
      normalize: (v) => this.normalizeEnumValue(v),
    },
    {
      enumType: "StatusInstalasi",
      sheet: "summary", 
      columnIndex: 18,
      normalize: (v) => this.normalizeStatusInstalasi(v),
    },
    {
      enumType: "StatusInstalasi",
      sheet: "detail",
      columnIndex: 18,
      normalize: (v) => this.normalizeStatusInstalasi(v),
    },
    {
      enumType: "JenisKendala",
      sheet: "detail",
      columnIndex: 11,
      normalize: (v) => this.normalizeEnumValue(v),
    },
    {
      enumType: "PlanTematik",
      sheet: "detail",
      columnIndex: 12,
      normalize: (v) => this.normalizeEnumValue(v),
    },
    {
      enumType: "StatusUsulan",
      sheet: "summary",
      columnIndex: 17,
      normalize: (v) => this.normalizeEnumValue(v),
    },
    {
      enumType: "StatusUsulan",
      sheet: "detail",
      columnIndex: 15,
      normalize: (v) => this.normalizeEnumValue(v),
    },
    {
      enumType: "Keterangan",
      sheet: "detail",
      columnIndex: 19,
      normalize: (v) => this.normalizeEnumValue(v),
    },
  ];

  constructor(googleSheets?: GoogleSheetsService) {
    this.googleSheets = googleSheets ?? new GoogleSheetsService();
  }

  async syncEnumsFromSheets(): Promise<{
    success: boolean;
    message: string;
    newEnums: Array<{ enumType: EnumType; value: string; displayName: string }>;
  }> {
    try {
      logger.info("Starting enum sync from Google Sheets...");

      const sheetValuesMap = await this.collectSheetEnumValues();
      const newEnums: Array<{ enumType: EnumType; value: string; displayName: string }> = [];

      for (const [enumType, values] of sheetValuesMap.entries()) {
        for (const value of values) {
          const existing = await prisma.enumValue.findUnique({
            where: {
              enumType_value: {
                enumType,
                value,
              },
            },
          });

          if (!existing) {
            const created = await prisma.enumValue.create({
              data: {
                enumType,
                value,
                displayName: this.generateDisplayName(value),
                isActive: true,
              },
            });

            newEnums.push({
              enumType,
              value: created.value,
              displayName: created.displayName || created.value,
            });

            logger.info(`Created new enum: ${enumType}.${value}`);
          }
        }
      }

      const message = newEnums.length > 0 
        ? `Enum sync completed: ${newEnums.length} new enums added`
        : "Enum sync completed: no new enums found";

      logger.info(message);

      return {
        success: true,
        message,
        newEnums,
      };
    } catch (error: any) {
      logger.error("Error syncing enums from sheets:", error);
      throw new Error(`Failed to sync enums: ${error.message}`);
    }
  }

  async getAllEnums(): Promise<Record<EnumType, Array<{ id: string; value: string; displayName: string }>>> {
    const enumValues = await prisma.enumValue.findMany({
      where: { isActive: true },
      orderBy: [{ enumType: 'asc' }, { value: 'asc' }],
    });

    const result = {} as Record<EnumType, Array<{ id: string; value: string; displayName: string }>>;

    // Initialize all enum types
    const enumTypes: EnumType[] = ["StatusJt", "StatusInstalasi", "JenisKendala", "PlanTematik", "StatusUsulan", "Keterangan"];
    enumTypes.forEach(type => {
      result[type] = [];
    });

    // Group by enum type
    enumValues.forEach(enumValue => {
      const enumType = enumValue.enumType as EnumType;
      if (result[enumType]) {
        result[enumType].push({
          id: enumValue.id,
          value: enumValue.value,
          displayName: enumValue.displayName || enumValue.value,
        });
      }
    });

    return result;
  }

  async findOrCreateEnumValue(enumType: EnumType, value: string): Promise<string> {
    if (!value) {
      throw new Error(`Value cannot be empty for enum type ${enumType}`);
    }

    const normalizedValue = this.normalizeEnumValue(value);
    if (!normalizedValue) {
      throw new Error(`Invalid value for enum type ${enumType}: ${value}`);
    }

    let enumValue = await prisma.enumValue.findUnique({
      where: {
        enumType_value: {
          enumType,
          value: normalizedValue,
        },
      },
    });

    if (!enumValue) {
      try {
        enumValue = await prisma.enumValue.create({
          data: {
            enumType,
            value: normalizedValue,
            displayName: this.generateDisplayName(normalizedValue),
            isActive: true,
          },
        });

        logger.info(`Auto-created new enum: ${enumType}.${normalizedValue}`);
      } catch (error: any) {
        // Handle race condition: another request created it first
        if (error.code === 'P2002') {
          logger.warn(`Enum ${enumType}.${normalizedValue} already exists (race condition), fetching...`);
          
          // Fetch the existing enum that was created by another request
          enumValue = await prisma.enumValue.findUnique({
            where: {
              enumType_value: {
                enumType,
                value: normalizedValue,
              },
            },
          });
          
          if (!enumValue) {
            throw new Error(`Failed to find enum ${enumType}.${normalizedValue} after race condition`);
          }
        } else {
          throw error;
        }
      }
    }

    return enumValue.id;
  }

  /**
   * Validate if enum value exists in database (without creating)
   * Returns true if valid, false otherwise
   */
  async validateEnumValue(enumType: EnumType, value: string | null): Promise<boolean> {
    if (!value) return true; // null is valid
    
    const normalizedValue = this.normalizeEnumValue(value);
    if (!normalizedValue) return false;

    const enumValue = await prisma.enumValue.findUnique({
      where: {
        enumType_value: {
          enumType,
          value: normalizedValue,
        },
      },
    });

    return enumValue !== null;
  }

  /**
   * Get all valid values for an enum type
   */
  async getValidValues(enumType: EnumType): Promise<string[]> {
    const enumValues = await prisma.enumValue.findMany({
      where: {
        enumType,
        isActive: true,
      },
      select: {
        value: true,
      },
    });

    return enumValues.map(ev => ev.value);
  }

  private async collectSheetEnumValues(): Promise<Map<EnumType, Set<string>>> {
    const summaryRows = await this.googleSheets.readRawSummaryRows();
    const detailRows = await this.googleSheets.readRawDetailRows();
    const result = new Map<EnumType, Set<string>>();

    for (const source of this.enumSources) {
      const rows = source.sheet === "summary" ? summaryRows : detailRows;
      for (const row of rows) {
        if (!Array.isArray(row)) continue;
        const rawValue = row[source.columnIndex];
        const normalized = source.normalize(rawValue);
        if (!normalized) continue;

        if (!result.has(source.enumType)) {
          result.set(source.enumType, new Set<string>());
        }
        result.get(source.enumType)!.add(normalized);
      }
    }

    return result;
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

  private generateDisplayName(value: string): string {
    return value
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Auto-update displayName from Google Sheets format
   * This will scan sheets and update displayName for all enum values
   */
  async autoUpdateDisplayNamesFromSheets(): Promise<{
    success: boolean;
    message: string;
    updated: Array<{ enumType: string; value: string; oldDisplayName: string | null; newDisplayName: string }>;
  }> {
    try {
      logger.info('Starting auto-update displayNames from Google Sheets...');

      const updated: Array<{ enumType: string; value: string; oldDisplayName: string | null; newDisplayName: string }> = [];

      // Read RAW data from sheets (without normalization)
      const rawSummaryRows = await this.googleSheets.readRawSummaryRows();
      const rawDetailRows = await this.googleSheets.readRawDetailRows();

      // Map to track: normalized value -> original sheet format
      const displayNameMap = new Map<string, Map<string, string>>(); // enumType -> (value -> displayName)

      // Process summary data (raw rows)
      for (const row of rawSummaryRows) {
        // StatusJt (column B / index 1)
        if (row[1]) {
          const rawValue = String(row[1]).trim();
          const normalized = this.normalizeEnumValue(rawValue);
          if (normalized && rawValue) {
            if (!displayNameMap.has('StatusJt')) {
              displayNameMap.set('StatusJt', new Map());
            }
            displayNameMap.get('StatusJt')!.set(normalized, rawValue);
          }
        }
      }

      // Process detail data (raw rows)
      for (const row of rawDetailRows) {
        // JenisKendala (column L / index 11)
        if (row[11]) {
          const rawValue = String(row[11]).trim();
          const normalized = this.normalizeEnumValue(rawValue);
          if (normalized && rawValue) {
            if (!displayNameMap.has('JenisKendala')) {
              displayNameMap.set('JenisKendala', new Map());
            }
            displayNameMap.get('JenisKendala')!.set(normalized, rawValue);
          }
        }

        // PlanTematik (column M / index 12)
        if (row[12]) {
          const rawValue = String(row[12]).trim();
          const normalized = this.normalizeEnumValue(rawValue);
          if (normalized && rawValue) {
            if (!displayNameMap.has('PlanTematik')) {
              displayNameMap.set('PlanTematik', new Map());
            }
            displayNameMap.get('PlanTematik')!.set(normalized, rawValue);
          }
        }

        // StatusUsulan (column P / index 15)
        if (row[15]) {
          const rawValue = String(row[15]).trim();
          const normalized = this.normalizeEnumValue(rawValue);
          if (normalized && rawValue) {
            if (!displayNameMap.has('StatusUsulan')) {
              displayNameMap.set('StatusUsulan', new Map());
            }
            displayNameMap.get('StatusUsulan')!.set(normalized, rawValue);
          }
        }

        // StatusInstalasi (column S / index 18)
        if (row[18]) {
          const rawValue = String(row[18]).trim();
          const normalized = this.normalizeStatusInstalasi(rawValue);
          if (normalized && rawValue) {
            if (!displayNameMap.has('StatusInstalasi')) {
              displayNameMap.set('StatusInstalasi', new Map());
            }
            displayNameMap.get('StatusInstalasi')!.set(normalized, rawValue);
          }
        }

        // Keterangan (column T / index 19)
        if (row[19]) {
          const rawValue = String(row[19]).trim();
          const normalized = this.normalizeEnumValue(rawValue);
          if (normalized && rawValue) {
            if (!displayNameMap.has('Keterangan')) {
              displayNameMap.set('Keterangan', new Map());
            }
            displayNameMap.get('Keterangan')!.set(normalized, rawValue);
          }
        }
      }

      // Update database
      for (const [enumType, valueMap] of displayNameMap.entries()) {
        for (const [value, displayName] of valueMap.entries()) {
          const existing = await prisma.enumValue.findUnique({
            where: {
              enumType_value: {
                enumType,
                value,
              },
            },
          });

          if (existing && existing.displayName !== displayName) {
            await prisma.enumValue.update({
              where: { id: existing.id },
              data: { displayName },
            });

            updated.push({
              enumType,
              value,
              oldDisplayName: existing.displayName,
              newDisplayName: displayName,
            });

            logger.info(`Updated displayName for ${enumType}.${value}: "${existing.displayName}" -> "${displayName}"`);
          }
        }
      }

      const message = updated.length > 0
        ? `Updated ${updated.length} displayNames from Google Sheets`
        : 'No displayNames needed updating';

      logger.info(message);

      return {
        success: true,
        message,
        updated,
      };
    } catch (error: any) {
      logger.error({ error }, 'Error auto-updating displayNames from sheets');
      throw new Error(`Failed to auto-update displayNames: ${error.message}`);
    }
  }
}
