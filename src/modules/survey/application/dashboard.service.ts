import type { ISyncRepository } from "../domain/sync.repository.js";
import type {
  DashboardQuery,
  Survey,
  ChartFilter,
  StatsData,
  SurveyCountByPeriod,
  ProfitLossCount,
  ProfitLossByMonth,
} from "../domain/sync.entity.js";
import logger from "../../../infrastructure/logging/logger.js";
import prisma from "../../../infrastructure/database/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";

export class DashboardService {
  constructor(private syncRepo: ISyncRepository) {}
  async getDashboardData(query: DashboardQuery): Promise<{
    data: Survey[];
    meta: {
      page: number;
      limit: number;
      total: number;
    };
  }> {
    try {
      const result = await this.syncRepo.findAllSurvey(query);

      const page =
        query.page && typeof query.page === "number" && query.page > 0
          ? query.page
          : 1;
      const limit =
        query.limit && typeof query.limit === "number" && query.limit > 0
          ? query.limit
          : 10;

      return {
        data: result.data,
        meta: {
          page,
          limit,
          total: result.total,
        },
      };
    } catch (error: any) {
      logger.error("Error getting dashboard data:", error);
      throw new Error(`Gagal mengambil data dashboard: ${error.message}`);
    }
  }

  async getDashboardDataByNomorNc(nomorNcx: string): Promise<Survey> {
    try {
      const data = await this.syncRepo.findSurveyByNomorNc(nomorNcx);
      if (!data) {
        throw new Error("Survey not found");
      }
      return data;
    } catch (error: any) {
      logger.error("Error getting dashboard data by nomorNcx:", error);
      throw error;
    }
  }
}

export class ChartService {
  async getSurveyCountByPeriod(
    filter?: ChartFilter
  ): Promise<SurveyCountByPeriod[]> {
    const where = this.buildPeriodWhere(filter);

    const surveys = await prisma.ndeUsulanB2B.findMany({
      where,
      select: {
        masterData: {
          select: { tglInputUsulan: true, bln: true },
        },
        createdAt: true,
      },
    });

    const periodCounts = new Map<string, number>();

    for (const s of surveys) {
      const period = this.extractPeriod(s, filter?.hariTerakhir);
      if (period) {
        periodCounts.set(period, (periodCounts.get(period) ?? 0) + 1);
      }
    }

    return Array.from(periodCounts.entries())
      .map(([periode, jumlah_survey]) => ({ periode, jumlah_survey }))
      .sort((a, b) => a.periode.localeCompare(b.periode));
  }

  async getProfitLossCount(filter?: ChartFilter): Promise<ProfitLossCount> {
    const where = this.buildPeriodWhere(filter);

    const surveys = await prisma.ndeUsulanB2B.findMany({
      where,
      select: {
        rabSurvey: true,
        nilaiKontrak: true,
        masterData: { select: { rabHld: true } },
      },
    });

    let untung = 0;
    let rugi = 0;

    for (const s of surveys) {
      const rabSurvey = s.rabSurvey ? Number(s.rabSurvey) : null;
      const rabHld = s.masterData?.rabHld ? Number(s.masterData.rabHld) : null;
      const nilaiKontrak = s.nilaiKontrak ? Number(s.nilaiKontrak) : null;

      const rab = rabSurvey ?? rabHld;
      if (rab === null || nilaiKontrak === null) continue;

      if (rab < nilaiKontrak) untung++;
      else if (rab > nilaiKontrak) rugi++;
    }

    return { untung, rugi };
  }

  async getProfitLossByMonth(
    filter?: ChartFilter
  ): Promise<ProfitLossByMonth[]> {
    const where = this.buildPeriodWhere(filter);

    const surveys = await prisma.ndeUsulanB2B.findMany({
      where,
      select: {
        rabSurvey: true,
        nilaiKontrak: true,
        masterData: {
          select: { rabHld: true, tglInputUsulan: true, bln: true },
        },
        createdAt: true,
      },
    });

    const monthData = new Map<string, { untung: number; rugi: number }>();

    for (const s of surveys) {
      const period = this.extractPeriod(s, filter?.hariTerakhir);
      if (!period) continue;

      const rabSurvey = s.rabSurvey ? Number(s.rabSurvey) : null;
      const rabHld = s.masterData?.rabHld ? Number(s.masterData.rabHld) : null;
      const nilaiKontrak = s.nilaiKontrak ? Number(s.nilaiKontrak) : null;

      const rab = rabSurvey ?? rabHld;
      if (rab === null || nilaiKontrak === null) continue;

      if (!monthData.has(period)) {
        monthData.set(period, { untung: 0, rugi: 0 });
      }
      const entry = monthData.get(period)!;
      if (rab < nilaiKontrak) entry.untung++;
      else if (rab > nilaiKontrak) entry.rugi++;
    }

    return Array.from(monthData.entries())
      .map(([bulan, counts]) => ({ bulan, ...counts }))
      .sort((a, b) => a.bulan.localeCompare(b.bulan));
  }

  private buildPeriodWhere(
    filter?: ChartFilter
  ): Prisma.NdeUsulanB2BWhereInput {
    if (filter?.hariTerakhir) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - filter.hariTerakhir);
      daysAgo.setHours(0, 0, 0, 0);

      return {
        masterData: {
          isNot: null,
          is: {
            tglInputUsulan: {
              gte: daysAgo,
            },
          },
        },
      };
    }

    if (!filter?.tahun) {
      return { masterData: { isNot: null } };
    }

    const year = filter.tahun;

    if (filter.bulan !== undefined && filter.bulan !== null) {
      const monthStart = new Date(year, filter.bulan - 1, 1);
      const monthEnd = new Date(year, filter.bulan, 1);

      return {
        masterData: {
          isNot: null,
          is: {
            OR: [
              {
                tglInputUsulan: {
                  gte: monthStart,
                  lt: monthEnd,
                },
              },
              {
                bln: {
                  contains: `${year}-${String(filter.bulan).padStart(2, "0")}`,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          },
        },
      };
    } else {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year + 1, 0, 1);

      return {
        masterData: {
          isNot: null,
          is: {
            OR: [
              {
                tglInputUsulan: {
                  gte: yearStart,
                  lt: yearEnd,
                },
              },
              {
                bln: {
                  startsWith: String(year),
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          },
        },
      };
    }
  }

  private extractPeriod(
    s: {
      masterData?: { tglInputUsulan?: Date | null; bln?: string | null } | null;
      createdAt?: Date;
    },
    hariTerakhir?: number
  ): string | null {
    const master = s.masterData;

    if (hariTerakhir) {
      if (master?.tglInputUsulan) {
        const d = new Date(master.tglInputUsulan);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(d.getDate()).padStart(2, "0")}`;
      }
      if (s.createdAt) {
        const d = new Date(s.createdAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(d.getDate()).padStart(2, "0")}`;
      }
      return null;
    }

    if (master?.tglInputUsulan) {
      const d = new Date(master.tglInputUsulan);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    if (master?.bln && /^\d{4}-\d{2}/.test(master.bln)) {
      return master.bln.substring(0, 7);
    }
    if (master?.bln) {
      return master.bln;
    }
    if (s.createdAt) {
      const d = new Date(s.createdAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    return null;
  }
}

export class StatsService {
  async getStats(filter?: ChartFilter): Promise<StatsData> {
    const where = this.buildPeriodWhere(filter);

    const surveys = await prisma.ndeUsulanB2B.findMany({
      where,
      select: {
        statusJt: {
          select: {
            value: true,
          },
        },
        masterData: {
          select: {
            statusUsulan: {
              select: {
                value: true,
              },
            },
          },
        },
      },
    });

    let totalSurvey = surveys.length;
    let totalPending = 0;
    let totalGoLive = 0;
    let totalApproved = 0;

    for (const s of surveys) {
      const statusUsulan = s.masterData?.statusUsulan?.value;
      const statusJt = s.statusJt?.value;

      if (
        statusUsulan &&
        statusUsulan !== "APPROVED" &&
        statusUsulan !== "CANCEL"
      ) {
        totalPending++;
      }

      if (statusJt === "GOLIVE") {
        totalGoLive++;
      }

      if (statusUsulan === "APPROVED") {
        totalApproved++;
      }
    }

    const approvalRate =
      totalSurvey > 0
        ? Math.round((totalApproved / totalSurvey) * 100 * 100) / 100
        : 0;

    return {
      totalSurvey,
      totalPending,
      totalGoLive,
      approvalRate,
    };
  }

  private buildPeriodWhere(
    filter?: ChartFilter
  ): Prisma.NdeUsulanB2BWhereInput {
    if (filter?.hariTerakhir) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - filter.hariTerakhir);
      daysAgo.setHours(0, 0, 0, 0);

      return {
        masterData: {
          isNot: null,
          is: {
            tglInputUsulan: {
              gte: daysAgo,
            },
          },
        },
      };
    }

    if (!filter?.tahun) {
      return { masterData: { isNot: null } };
    }

    const year = filter.tahun;

    if (filter.bulan !== undefined && filter.bulan !== null) {
      const monthStart = new Date(year, filter.bulan - 1, 1);
      const monthEnd = new Date(year, filter.bulan, 1);

      return {
        masterData: {
          isNot: null,
          is: {
            OR: [
              {
                tglInputUsulan: {
                  gte: monthStart,
                  lt: monthEnd,
                },
              },
              {
                bln: {
                  contains: `${year}-${String(filter.bulan).padStart(2, "0")}`,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          },
        },
      };
    } else {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year + 1, 0, 1);

      return {
        masterData: {
          isNot: null,
          is: {
            OR: [
              {
                tglInputUsulan: {
                  gte: yearStart,
                  lt: yearEnd,
                },
              },
              {
                bln: {
                  startsWith: String(year),
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          },
        },
      };
    }
  }
}
