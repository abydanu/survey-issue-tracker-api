import { createRoute, z } from '@hono/zod-openapi';

const EnumValuesSchema = z.object({
  jenisKendala: z.array(z.string()).openapi({ example: ['ODP_FULL', 'JARAK_PT1_250'] }),
  planTematik: z.array(z.string()).openapi({ example: ['PT1', 'PT2S'] }),
  statusUsulan: z.array(z.string()).openapi({ example: ['REVIEW_SDI', 'APPROVED'] }),
  statusInstalasi: z.array(z.string()).openapi({ example: ['REVIEW', 'SURVEY'] }),
  keterangan: z.array(z.string()).openapi({ example: ['PELANGGAN_BATAL', 'PT1_ONLY'] }),
  statusJt: z.array(z.string()).openapi({ example: ['AANWIJZING', 'APPROVE'] })
});

const EnumItemSchema = z.object({
  id: z.string().openapi({ example: 'clx123abc' }),
  value: z.string().openapi({ example: 'ODP_FULL' }),
  displayName: z.string().openapi({ example: 'Odp Full' })
});

const AllEnumsSchema = z.object({
  StatusJt: z.array(EnumItemSchema),
  StatusInstalasi: z.array(EnumItemSchema),
  JenisKendala: z.array(EnumItemSchema),
  PlanTematik: z.array(EnumItemSchema),
  StatusUsulan: z.array(EnumItemSchema),
  Keterangan: z.array(EnumItemSchema)
});

const ApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional()
});

export const getFilterEnumsRoute = createRoute({
  method: 'get',
  path: '/enums',
  tags: ['Enums'],
  summary: 'Get all filter enums',
  description: 'Retrieve all enum values that can be used for filtering in the frontend',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
            data: EnumValuesSchema
          })
        }
      },
      description: 'Successfully retrieved filter enums'
    },
    401: {
      content: {
        'application/json': {
          schema: ApiResponseSchema
        }
      },
      description: 'Unauthorized'
    },
    500: {
      content: {
        'application/json': {
          schema: ApiResponseSchema
        }
      },
      description: 'Internal server error'
    }
  }
});

export const getAllEnumsRoute = createRoute({
  method: 'get',
  path: '/enums/all',
  tags: ['Enums'],
  summary: 'Get all enums with IDs',
  description: 'Retrieve all enum values with their IDs and display names for form dropdowns',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
            data: AllEnumsSchema
          })
        }
      },
      description: 'Successfully retrieved all enums with IDs'
    },
    401: {
      content: {
        'application/json': {
          schema: ApiResponseSchema
        }
      },
      description: 'Unauthorized'
    },
    500: {
      content: {
        'application/json': {
          schema: ApiResponseSchema
        }
      },
      description: 'Internal server error'
    }
  }
});