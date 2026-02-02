import { z } from '../../../shared/utils/zod.js';
import { createRoute } from '@hono/zod-openapi';
import { safeNumberTransform } from '../../../shared/utils/number.js';

const JenisKendalaEnum = z.enum([
  'ODP_FULL',
  'JARAK_PT1_250',
  'BLANK_FO',
  'JARAK_JAUH_500',
  'BLANK_TIANG',
  'NEED_MATAM_3PCS',
]);

const PlanTematikEnum = z.enum(['PT1', 'PT2S', 'PT2NS', 'PT3', 'PT4', 'TKAP']);

const StatusUsulanEnum = z.enum([
  'REVIEW_SDI',
  'BELUM_INPUT',
  'REVIEW_OPTIMA',
  'REVIEW_ED',
  'CEK_SDI_REGIONAL',
  'APPROVED',
  'DROP_LOP',
  'KONFIRMASI_ULANG',
  'NOT_APPROVED',
  'PENDING',
  'CANCEL',
  'OGP_IHLD',
  'WAITING_CARING',
]);

const ProjectStatusEnum = z.enum([
  'REVIEW',
  'SURVEY',
  'INSTALASI',
  'DONE_INSTALASI',
  'GO_LIVE',
  'CANCEL',
  'PENDING',
  'KENDALA',
  'WAITING_BUDGET',
  'DROP',
  'WAITING_PROJECT_JPP',
  'WAITING_CB',
]);

const ProjectIssueEnum = z.enum([
  'PELANGGAN_BATAL',
  'PT1_ONLY',
  'PERIJINAN',
  'AKI_TIDAK_LAYAK',
  'REDESIGN',
  'INDIKASI_RESELLER',
  'FEEDER_HABIS',
  'KENDALA_IZIN_TANAM_TN',
  'PORT_OLT_HABIS',
  'MATTAM_TIANG',
  'DISTRIBUSI_HABIS',
  'MENUNGGU_M_OLT',
  'MENUNGGU_RELOKASI_TIANG_PLN',
  'CORE_DISTRIBUSI_CACAT',
  'MENUNGGU_CO_FEEDER',
  'PORT_EA_HABIS',
  'INVALID_LOCATION',
  'HOLD_BY_BGES',
  'WAITING_REVIT_ODP',
  'HOLD_BY_PED',
]);

const SurveySchema = z.object({
  id: z.string().optional(),
  no: z.string(),

  bln: z.string().nullable().optional(),
  tglInput: z.string().nullable().optional().transform((val) => (val ? new Date(val) : null)),
  idKendala: z.string().nullable().optional(),
  jenisOrder: z.string().nullable().optional(),
  datel: z.string().nullable().optional(),
  sto: z.string().nullable().optional(),
  namaPelanggan: z.string().nullable().optional(),
  latitude: z.string().nullable().optional(),
  longitude: z.string().nullable().optional(),
  jenisKendala: JenisKendalaEnum.nullable().optional(),
  pltTemuan: PlanTematikEnum.nullable().optional(),
  rabHldSummary: z.number().nullable().optional(),
  ihld: z.number().nullable().optional(),
  statusUsulan: StatusUsulanEnum.nullable().optional(),
  statusIhld: z.string().nullable().optional(),
  idEprop: z.string().nullable().optional(),
  statusInstalasi: ProjectStatusEnum.nullable().optional(),
  keterangan: ProjectIssueEnum.nullable().optional(),
  newSc: z.string().nullable().optional(),

  statusJt: z.string().nullable().optional(),
  c2r: z.number().nullable().optional(),
  nomorNcx: z.string().nullable().optional(),
  alamat: z.string().nullable().optional(),
  jenisLayanan: z.string().nullable().optional(),
  nilaiKontrak: z.string().nullable().optional().transform((val) => (val ? BigInt(val) : null)),
  ihldLop: z.number().nullable().optional(),
  planTematik: PlanTematikEnum.nullable().optional(),
  rabHldDetail: z.string().nullable().optional().transform((val) => (val ? BigInt(val) : null)),
  rabSurvey: z.string().nullable().optional().transform((val) => (val ? BigInt(val) : null)),
  noNde: z.string().nullable().optional(),
  progresJt: z.string().nullable().optional(),
  namaOdp: z.string().nullable().optional(),
  jarakOdp: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((val) => (val === null || val === undefined || val === '' ? null : Number(val))),
  keteranganText: z.string().nullable().optional(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const AdminEditableSurveyBaseSchema = z.object({
  no: z.string(),

  statusJt: z.string().nullable().optional(),
  c2r: z.number().nullable().optional(),
  alamat: z.string().nullable().optional(),
  jenisLayanan: z.string().nullable().optional(),
  nilaiKontrak: z.union([z.string(), z.number()]).nullable().optional().transform(safeNumberTransform),
  rabSurvey: z.union([z.string(), z.number()]).nullable().optional().transform(safeNumberTransform),
  noNde: z.string().nullable().optional(),
  progresJt: z.string().nullable().optional(),
  namaOdp: z.string().nullable().optional(),
  jarakOdp: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((val) => (val === null || val === undefined || val === '' ? null : Number(val))),
  keteranganText: z.string().nullable().optional(),
});

export const CreateSurveyRequestSchema = AdminEditableSurveyBaseSchema.extend({
  nomorNcx: z.string().optional(), 
});

export const UpdateSurveyRequestSchema = AdminEditableSurveyBaseSchema.omit({ 
  no: true,
  nomorNcx: true
})
  .partial();

export const SurveyResponseSchema = SurveySchema;

export const ApiSuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional(),
});

export const PaginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
});

export const GetSurveyResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  meta: PaginationMetaSchema,
  data: z.array(SurveyResponseSchema),
});

export const ApiErrorResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  errors: z.any().optional(),
});

export const getSurveyRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Survey'],
  summary: 'Get survey data',
  description: 'Mendapatkan data survey dengan filter dan pagination (User & Admin)',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.string().optional().openapi({
        param: { name: 'page', in: 'query' },
        example: '1',
        description: 'Nomor halaman (default: 1)',
      }),
      limit: z.string().optional().openapi({
        param: { name: 'limit', in: 'query' },
        example: '10',
        description: 'Jumlah data per halaman (default: 10)',
      }),
      search: z.string().optional().openapi({
        param: { name: 'search', in: 'query' },
        example: 'NCX123',
        description: 'Search by nomor NCX',
      }),
      statusJt: z.string().optional().openapi({
        param: { name: 'statusJt', in: 'query' },
        example: 'APPROVE',
        description: 'Filter by Status JT',
      }),
      rabHldMin: z.string().optional().openapi({
        param: { name: 'rabHldMin', in: 'query' },
        example: '1000000',
        description: 'Filter by RAB HLD minimum',
      }),
      rabHldMax: z.string().optional().openapi({
        param: { name: 'rabHldMax', in: 'query' },
        example: '1000000',
        description: 'Filter by RAB HLD maximum',
      }),
      tahun: z.string().optional().openapi({
        param: { name: 'tahun', in: 'query' },
        example: '2024',
        description: 'Filter by tahun',
      }),
      datel: z.string().optional().openapi({
        param: { name: 'datel', in: 'query' },
        example: 'DATEL001',
        description: 'Filter by datel',
      }),
      sto: z.string().optional().openapi({
        param: { name: 'sto', in: 'query' },
        example: 'STO001',
        description: 'Filter by STO',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Data dashboard berhasil diambil',
      content: {
        'application/json': {
          schema: GetSurveyResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
});

export const ChartFilterSchema = z.object({
  tahun: z.string().optional().openapi({
    param: { name: 'tahun', in: 'query' },
    example: '2026',
    description: 'Filter by year. If only year: all months in that year. Ignored if hariTerakhir is set.',
  }),
  bulan: z.string().optional().openapi({
    param: { name: 'bulan', in: 'query' },
    example: '2',
    description: 'Filter by month (1-12). Combined with tahun for specific month. Ignored if hariTerakhir is set.',
  }),
  hariTerakhir: z.string().optional().openapi({
    param: { name: 'hariTerakhir', in: 'query' },
    example: '7',
    description: 'Filter by last N days (e.g., 7, 30, 90). This has highest priority and overrides tahun/bulan filters.',
  }),
});

export const getChartSurveyCountRoute = createRoute({
  method: 'get',
  path: '/chart/survey-count',
  tags: ['Analytics'],
  summary: 'Line Chart: Survey count per period',
  description: 'Count survey per month or year. For line chart.',
  security: [{ bearerAuth: [] }],
  request: { query: ChartFilterSchema },
  responses: {
    200: {
      description: 'Survey count by period',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            data: z.array(z.object({
              periode: z.string(),
              jumlah_survey: z.number(),
            })),
          }),
        },
      },
    },
  },
});

export const getStatsRoute = createRoute({
  method: 'get',
  path: '/stats',
  tags: ['Analytics'],
  summary: 'Get analytics statistics',
  description: 'Get total survey, pending, go live count, and approval rate',
  security: [{ bearerAuth: [] }],
  request: { query: ChartFilterSchema },
  responses: {
    200: {
      description: 'Analytics data retrieved successfully',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            data: z.object({
              totalSurvey: z.number().openapi({
                description: 'Total number of surveys',
                example: 150,
              }),
              totalPending: z.number().openapi({
                description: 'Total surveys in pending state (not APPROVED and not CANCEL)',
                example: 45,
              }),
              totalGoLive: z.number().openapi({
                description: 'Total surveys with GO_LIVE status',
                example: 80,
              }),
              approvalRate: z.number().openapi({
                description: 'Approval rate percentage (approved/total * 100)',
                example: 65.33,
              }),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
});

export const getChartProfitLossRoute = createRoute({
  method: 'get',
  path: '/chart/profit-loss-pie',
  tags: ['Analytics'],
  summary: 'Pie/Donut Chart: Profit vs Loss count',
  description: 'Profit (RAB < Contract) vs Loss (RAB > Contract). Fallback RAB HLD if RAB Survey empty.',
  security: [{ bearerAuth: [] }],
  request: { query: ChartFilterSchema },
  responses: {
    200: {
      description: 'Profit and loss count',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            data: z.object({
              untung: z.number(),
              rugi: z.number(),
            }),
          }),
        },
      },
    },
  },
});

export const getChartProfitLossByMonthRoute = createRoute({
  method: 'get',
  path: '/chart/profit-loss-area',
  tags: ['Analytics'],
  summary: 'Area Chart: Profit/Loss count per month',
  description: 'Count profit and loss per month for area chart.',
  security: [{ bearerAuth: [] }],
  request: { query: ChartFilterSchema },
  responses: {
    200: {
      description: 'Profit and loss by month',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            data: z.array(z.object({
              bulan: z.string(),
              untung: z.number(),
              rugi: z.number(),
            })),
          }),
        },
      },
    },
  },
});

export const getSyncStatusRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Sync'],
  summary: 'Get sync log',
  description: 'Mendapatkan status sinkronisasi terakhir (Admin only)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Status sinkronisasi berhasil diambil',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            data: z.object({
              lastSync: z.object({
                id: z.string(),
                status: z.string(),
                message: z.string().nullable(),
                sheetName: z.string().nullable(),
                syncedAt: z.string(),
              }).nullable(),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
});

export const syncFromSheetsRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Sync'],
  summary: 'Sync from Google Sheets',
  description: 'Sinkronisasi data dari Google Sheets ke Database (Admin only)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Sinkronisasi berhasil',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
});

export const createSurveyRoute = createRoute({
  method: 'post',
  path: '/survey',
  tags: ['Survey'],
  summary: 'Create survey (Admin only)',
  description: 'Membuat data survey baru',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateSurveyRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Survey berhasil dibuat',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            data: SurveyResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Data sudah ada atau invalid',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
});

export const updateSurveyRoute = createRoute({
  method: 'put',
  path: '/survey/{nomorNcx}',
  tags: ['Survey'],
  summary: 'Update survey (Admin only)',
  description: 'Update data survey berdasarkan nomor NCX/Starclick. Note: nomorNcx diambil dari URL path, tidak perlu dikirim di body.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      nomorNcx: z.string().openapi({ example: 'NCX123' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateSurveyRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Survey berhasil diupdate',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            data: SurveyResponseSchema,
          }),
        },
      },
    },
    404: {
      description: 'Data tidak ditemukan',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
});

export const deleteSurveyRoute = createRoute({
  method: 'delete',
  path: '/survey/{nomorNcx}',
  tags: ['Survey'],
  summary: 'Delete survey (Admin only)',
  description: 'Menghapus data survey berdasarkan nomor NCX/Starclick',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      nomorNcx: z.string().openapi({ example: 'NCX123' }),
    }),
  },
  responses: {
    200: {
      description: 'Survey berhasil dihapus',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema,
        },
      },
    },
    404: {
      description: 'Data tidak ditemukan',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
});