import prisma from '../../infrastructure/database/prisma.js';
import logger from '../../infrastructure/logging/logger.js';

export interface SyncValidationResult {
  isValid: boolean;
  missingMasterData: string[];
  duplicateKeys: string[];
  invalidRecords: string[];
  summary: {
    totalSummaryRecords: number;
    totalDetailRecords: number;
    validSummaryRecords: number;
    invalidSummaryRecords: number;
  };
}

export class SyncValidationHelper {
  static async validateSyncData(
    summaryData: Array<{ no?: string; nomorNcx?: string }>,
    detailData: Array<{ idKendala?: string }>
  ): Promise<SyncValidationResult> {
    logger.info('Starting sync data validation...');

    const result: SyncValidationResult = {
      isValid: true,
      missingMasterData: [],
      duplicateKeys: [],
      invalidRecords: [],
      summary: {
        totalSummaryRecords: summaryData.length,
        totalDetailRecords: detailData.length,
        validSummaryRecords: 0,
        invalidSummaryRecords: 0,
      },
    };

    
    const validIdKendalaSet = new Set<string>();
    const duplicateIdKendala = new Set<string>();
    const seenIdKendala = new Set<string>();

    
    for (const detail of detailData) {
      if (detail.idKendala && detail.idKendala.trim()) {
        const idKendala = detail.idKendala.trim();
        if (seenIdKendala.has(idKendala)) {
          duplicateIdKendala.add(idKendala);
        } else {
          seenIdKendala.add(idKendala);
          validIdKendalaSet.add(idKendala);
        }
      }
    }

    result.duplicateKeys = Array.from(duplicateIdKendala);

    
    for (const summary of summaryData) {
      
      const nomorNcx = summary.nomorNcx || (summary as any).nomorNc || (summary as any).nomor_ncx;
      const no = summary.no || (summary as any).NO;
      
      if (!no || !nomorNcx || !String(nomorNcx).trim()) {
        result.invalidRecords.push(`Invalid record: no=${no}, nomorNcx=${nomorNcx}, available fields: ${Object.keys(summary).join(', ')}`);
        result.summary.invalidSummaryRecords++;
        continue;
      }

      const nomorNcxStr = String(nomorNcx).trim();
      if (!validIdKendalaSet.has(nomorNcxStr)) {
        result.missingMasterData.push(`nomorNcx: ${nomorNcxStr} (no: ${no})`);
        result.summary.invalidSummaryRecords++;
      } else {
        result.summary.validSummaryRecords++;
      }
    }

    
    result.isValid = 
      result.missingMasterData.length === 0 && 
      result.duplicateKeys.length === 0 && 
      result.invalidRecords.length === 0;

    
      logger.info({
        isValid: result.isValid,
        totalSummaryRecords: result.summary.totalSummaryRecords,
        totalDetailRecords: result.summary.totalDetailRecords,
        validSummaryRecords: result.summary.validSummaryRecords,
        invalidSummaryRecords: result.summary.invalidSummaryRecords,
        missingMasterDataCount: result.missingMasterData.length,
        duplicateKeysCount: result.duplicateKeys.length,
        invalidRecordsCount: result.invalidRecords.length,
      }, `Sync validation completed:`);

    if (!result.isValid) {
      logger.warn('Sync validation failed. Issues found:');
      if (result.missingMasterData.length > 0) {
        logger.warn(result.missingMasterData.slice(0, 10), `Missing master data for ${result.missingMasterData.length} records:`);
      }
      if (result.duplicateKeys.length > 0) {
        logger.warn(result.duplicateKeys, `Duplicate keys found:`);
      }
      if (result.invalidRecords.length > 0) {
        logger.warn(result.invalidRecords.slice(0, 10), `Invalid records found:`);
      }
    }

    return result;
  }

  static async checkDatabaseIntegrity(): Promise<{
    orphanedRecords: Array<{ no: string; nomorNcx: string }>;
    missingMasterData: string[];
  }> {
    logger.info('Checking database integrity...');

    
    const orphanedRecords = await prisma.ndeUsulanB2B.findMany({
      where: {
        masterData: null,
      },
      select: {
        no: true,
        nomorNcx: true,
      },
    });

    const missingMasterData = orphanedRecords.map(record => record.nomorNcx);

    logger.info({
      orphanedRecordsCount: orphanedRecords.length,
      missingMasterDataCount: missingMasterData.length,
    }, `Database integrity check completed:`);

    if (orphanedRecords.length > 0) {
      logger.warn(orphanedRecords.slice(0, 10), `Found ${orphanedRecords.length} orphaned records without master data:`);
    }

    return {
      orphanedRecords,
      missingMasterData,
    };
  }

  static generateValidationReport(validationResult: SyncValidationResult): string {
    const lines = [
      '=== SYNC VALIDATION REPORT ===',
      `Status: ${validationResult.isValid ? 'VALID' : 'INVALID'}`,
      '',
      '--- SUMMARY ---',
      `Total Summary Records: ${validationResult.summary.totalSummaryRecords}`,
      `Total Detail Records: ${validationResult.summary.totalDetailRecords}`,
      `Valid Summary Records: ${validationResult.summary.validSummaryRecords}`,
      `Invalid Summary Records: ${validationResult.summary.invalidSummaryRecords}`,
      '',
    ];

    if (validationResult.missingMasterData.length > 0) {
      lines.push('--- MISSING MASTER DATA ---');
      lines.push(`Count: ${validationResult.missingMasterData.length}`);
      lines.push('Records:');
      validationResult.missingMasterData.slice(0, 20).forEach(record => {
        lines.push(`  - ${record}`);
      });
      if (validationResult.missingMasterData.length > 20) {
        lines.push(`  ... and ${validationResult.missingMasterData.length - 20} more`);
      }
      lines.push('');
    }

    if (validationResult.duplicateKeys.length > 0) {
      lines.push('--- DUPLICATE KEYS ---');
      lines.push(`Count: ${validationResult.duplicateKeys.length}`);
      lines.push('Keys:');
      validationResult.duplicateKeys.forEach(key => {
        lines.push(`  - ${key}`);
      });
      lines.push('');
    }

    if (validationResult.invalidRecords.length > 0) {
      lines.push('--- INVALID RECORDS ---');
      lines.push(`Count: ${validationResult.invalidRecords.length}`);
      lines.push('Records:');
      validationResult.invalidRecords.slice(0, 10).forEach(record => {
        lines.push(`  - ${record}`);
      });
      if (validationResult.invalidRecords.length > 10) {
        lines.push(`  ... and ${validationResult.invalidRecords.length - 10} more`);
      }
      lines.push('');
    }

    lines.push('=== END REPORT ===');
    return lines.join('\n');
  }
}