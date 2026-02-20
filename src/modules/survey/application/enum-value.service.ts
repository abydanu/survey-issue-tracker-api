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
    deactivatedEnums: Array<{ enumType: EnumType; value: string; displayName: string }>;
  }> {
    try {
      logger.info("Starting enum sync from Google Sheets...");

      const sheetValuesMap = await this.collectSheetEnumValuesWithDisplayNames();
      const newEnums: Array<{ enumType: EnumType; value: string; displayName: string }> = [];
      const deactivatedEnums: Array<{ enumType: EnumType; value: string; displayName: string }> = [];

      
      const allExistingEnums = await prisma.enumValue.findMany({
        where: {
          enumType: {
            in: ["StatusJt", "StatusInstalasi", "JenisKendala", "PlanTematik", "StatusUsulan", "Keterangan"]
          }
        }
      });

      
      const existingEnumsMap = new Map<string, typeof allExistingEnums[0]>();
      for (const enumValue of allExistingEnums) {
        const key = `${enumValue.enumType}:${enumValue.value}`;
        existingEnumsMap.set(key, enumValue);
      }

      
      const toCreate: Array<{ enumType: string; value: string; displayName: string }> = [];
      const toUpdate: Array<{ id: string; displayName: string; isActive: boolean }> = [];

      for (const [enumType, valuesMap] of sheetValuesMap.entries()) {
        for (const [value, displayName] of valuesMap.entries()) {
          const key = `${enumType}:${value}`;
          const existing = existingEnumsMap.get(key);

          if (!existing) {
            toCreate.push({
              enumType,
              value,
              displayName,
            });
            newEnums.push({ enumType, value, displayName });
          } else if (!existing.isActive) {
            toUpdate.push({
              id: existing.id,
              displayName,
              isActive: true,
            });
            logger.info(`Reactivated enum: ${enumType}.${value}`);
          }
        }
      }

      
      if (toCreate.length > 0) {
        await prisma.enumValue.createMany({
          data: toCreate.map(e => ({
            enumType: e.enumType,
            value: e.value,
            displayName: e.displayName,
            isActive: true,
          })),
          skipDuplicates: true,
        });
        logger.info(`Created ${toCreate.length} new enums`);
      }

      
      if (toUpdate.length > 0) {
        await Promise.all(
          toUpdate.map(u =>
            prisma.enumValue.update({
              where: { id: u.id },
              data: { isActive: u.isActive, displayName: u.displayName },
            })
          )
        );
      }

      
      const allEnumTypes: EnumType[] = ["StatusJt", "StatusInstalasi", "JenisKendala", "PlanTematik", "StatusUsulan", "Keterangan"];

      for (const enumType of allEnumTypes) {
        const sheetValues = sheetValuesMap.get(enumType);
        if (!sheetValues) continue;

        const sheetValueSet = new Set(sheetValues.keys());

        
        const toDeactivate = allExistingEnums.filter(
          e => e.enumType === enumType && e.isActive && !sheetValueSet.has(e.value)
        );

        if (toDeactivate.length > 0) {
          await prisma.enumValue.updateMany({
            where: {
              id: { in: toDeactivate.map(e => e.id) },
            },
            data: { isActive: false },
          });

          for (const dbEnum of toDeactivate) {
            deactivatedEnums.push({
              enumType: enumType as EnumType,
              value: dbEnum.value,
              displayName: dbEnum.displayName || dbEnum.value,
            });
            logger.info(`Deactivated enum (not in sheet): ${enumType}.${dbEnum.value}`);
          }
        }
      }

      const message =
        newEnums.length > 0 || deactivatedEnums.length > 0
          ? `Enum sync completed: ${newEnums.length} new, ${deactivatedEnums.length} deactivated`
          : "Enum sync completed: no changes";

      logger.info(message);

      return {
        success: true,
        message,
        newEnums,
        deactivatedEnums,
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

    const enumTypes: EnumType[] = ["StatusJt", "StatusInstalasi", "JenisKendala", "PlanTematik", "StatusUsulan", "Keterangan"];
    enumTypes.forEach(type => {
      result[type] = [];
    });

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

  async findOrCreateEnumValue(enumType: EnumType, value: string, displayName?: string): Promise<string> {
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

        const cleanDisplayName = displayName ? displayName.replace(/_/g, ' ') : normalizedValue.replace(/_/g, ' ');

        enumValue = await prisma.enumValue.create({
          data: {
            enumType,
            value: normalizedValue,
            displayName: cleanDisplayName,
            isActive: true,
          },
        });

        logger.info(`Auto-created new enum: ${enumType}.${normalizedValue} with displayName: ${cleanDisplayName}`);
      } catch (error: any) {
        if (error.code === 'P2002') {

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
    } else if (displayName && enumValue.displayName !== displayName) {

      const cleanDisplayName = displayName.replace(/_/g, ' ');
      if (enumValue.displayName !== cleanDisplayName) {
        try {
          enumValue = await prisma.enumValue.update({
            where: { id: enumValue.id },
            data: { displayName: cleanDisplayName },
          });

          if (process.env.NODE_ENV !== 'production') {
            logger.info(`Updated displayName for ${enumType}.${normalizedValue}: ${cleanDisplayName}`);
          }
        } catch (error: any) {
          logger.warn(`Failed to update displayName for ${enumType}.${normalizedValue}:`, error);
        }
      }
    }

    return enumValue.id;
  }

  async validateEnumValue(enumType: EnumType, value: string | null): Promise<boolean> {
    if (!value) return true;

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
    const valuesWithDisplayNames = await this.collectSheetEnumValuesWithDisplayNames();
    const result = new Map<EnumType, Set<string>>();

    for (const [enumType, valuesMap] of valuesWithDisplayNames.entries()) {
      result.set(enumType, new Set(valuesMap.keys()));
    }

    return result;
  }

  private async collectSheetEnumValuesWithDisplayNames(): Promise<Map<EnumType, Map<string, string>>> {
    const result = new Map<EnumType, Map<string, string>>();

    
    const allEnumTypes: EnumType[] = ["StatusJt", "StatusInstalasi", "JenisKendala", "PlanTematik", "StatusUsulan", "Keterangan"];
    for (const enumType of allEnumTypes) {
      result.set(enumType, new Map<string, string>());
    }

    
    logger.info("Reading enum values from data validation rules...");
    try {
      const [
        statusJtValidation,
        statusInstalasiValidation,
        jenisKendalaValidation,
        planTematikValidation,
        statusUsulanValidation,
        keteranganValidation,
      ] = await Promise.all([
        this.googleSheets.readDataValidationValues('NDE USULAN B2B', 'B'),
        this.googleSheets.readDataValidationValues('NDE USULAN B2B', 'S'),
        this.googleSheets.readDataValidationValues('NEW BGES B2B & OLO', 'L'),
        this.googleSheets.readDataValidationValues('NEW BGES B2B & OLO', 'M'),
        this.googleSheets.readDataValidationValues('NEW BGES B2B & OLO', 'P'),
        this.googleSheets.readDataValidationValues('NEW BGES B2B & OLO', 'T'),
      ]);

      
      for (const value of statusJtValidation) {
        const normalized = await this.normalizeEnumValue(value);
        if (normalized) {
          result.get('StatusJt')!.set(normalized, value.trim());
        }
      }
      logger.info(`Found ${statusJtValidation.length} StatusJt values from data validation`);

      
      for (const value of statusInstalasiValidation) {
        const normalized = await this.normalizeStatusInstalasi(value);
        if (normalized) {
          result.get('StatusInstalasi')!.set(normalized, value.trim());
        }
      }
      logger.info(`Found ${statusInstalasiValidation.length} StatusInstalasi values from data validation`);

      // Fallback: if StatusInstalasi validation is empty, read from actual data
      if (statusInstalasiValidation.length === 0) {
        logger.info('StatusInstalasi validation empty, falling back to reading from sheet data...');
        const summaryRows = await this.googleSheets.readRawSummaryRows();
        
        for (const row of summaryRows) {
          if (!Array.isArray(row)) continue;
          const rawValue = row[18]; // Column S (index 18)
          if (!rawValue) continue;

          const normalized = this.normalizeStatusInstalasi(rawValue);
          if (!normalized) continue;

          const displayName = String(rawValue).trim();
          if (!result.get('StatusInstalasi')!.has(normalized)) {
            result.get('StatusInstalasi')!.set(normalized, displayName);
          }
        }
        logger.info(`Found ${result.get('StatusInstalasi')!.size} StatusInstalasi values from sheet data`);
      }

      
      for (const value of jenisKendalaValidation) {
        const normalized = await this.normalizeEnumValue(value);
        if (normalized) {
          result.get('JenisKendala')!.set(normalized, value.trim());
        }
      }
      logger.info(`Found ${jenisKendalaValidation.length} JenisKendala values from data validation`);

      
      for (const value of planTematikValidation) {
        const normalized = await this.normalizeEnumValue(value);
        if (normalized) {
          result.get('PlanTematik')!.set(normalized, value.trim());
        }
      }
      logger.info(`Found ${planTematikValidation.length} PlanTematik values from data validation`);

      
      for (const value of statusUsulanValidation) {
        const normalized = await this.normalizeEnumValue(value);
        if (normalized) {
          result.get('StatusUsulan')!.set(normalized, value.trim());
        }
      }
      logger.info(`Found ${statusUsulanValidation.length} StatusUsulan values from data validation`);

      
      for (const value of keteranganValidation) {
        const normalized = await this.normalizeEnumValue(value);
        if (normalized) {
          result.get('Keterangan')!.set(normalized, value.trim());
        }
      }
      logger.info(`Found ${keteranganValidation.length} Keterangan values from data validation`);
    } catch (error: any) {
      logger.warn(`Failed to read data validation: ${error.message}, falling back to data-only sync`);
      
      
      const summaryRows = await this.googleSheets.readRawSummaryRows();
      const detailRows = await this.googleSheets.readRawDetailRows();

      for (const source of this.enumSources) {
        const rows = source.sheet === "summary" ? summaryRows : detailRows;
        for (const row of rows) {
          if (!Array.isArray(row)) continue;
          const rawValue = row[source.columnIndex];
          if (!rawValue) continue;

          const normalized = source.normalize(rawValue);
          if (!normalized) continue;

          const displayName = String(rawValue).trim();

          if (!result.get(source.enumType)!.has(normalized)) {
            result.get(source.enumType)!.set(normalized, displayName);
          }
        }
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
      GOLIVE: "GOLIVE",
      "GO LIVE": "GOLIVE",
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

  async autoUpdateDisplayNamesFromSheets(): Promise<{
    success: boolean;
    message: string;
    updated: Array<{ enumType: string; value: string; oldDisplayName: string | null; newDisplayName: string }>;
  }> {
    try {
      logger.info('Starting auto-update displayNames from Google Sheets...');

      const updated: Array<{ enumType: string; value: string; oldDisplayName: string | null; newDisplayName: string }> = [];


      const rawSummaryRows = await this.googleSheets.readRawSummaryRows();
      const rawDetailRows = await this.googleSheets.readRawDetailRows();


      const displayNameMap = new Map<string, Map<string, string>>();


      for (const row of rawSummaryRows) {

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


      for (const row of rawDetailRows) {

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

            // Only log in development, and only once per unique enum value
            if (process.env.NODE_ENV !== 'production' && updated.length <= 50) {
              logger.info(`Updated displayName for ${enumType}.${value}: "${existing.displayName}" -> "${displayName}"`);
            }
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
