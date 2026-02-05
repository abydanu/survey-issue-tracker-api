import { createRoute, z } from '@hono/zod-openapi';

const EnumValuesSchema = z.object({
  jenisKendala: z.array(z.string()).openapi({ example: ['ODP_FULL', 'JARAK_PT1_250'] }),
  planTematik: z.array(z.string()).openapi({ example: ['PT1', 'PT2S'] }),
  statusUsulan: z.array(z.string()).openapi({ example: ['REVIEW_SDI', 'APPROVED'] }),
  statusInstalasi: z.array(z.string()).openapi({ example: ['REVIEW', 'SURVEY'] }),
  keterangan: z.array(z.string()).openapi({ example: ['PELANGGAN_BATAL', 'PT1_ONLY'] }),
  statusJt: z.array(z.string()).openapi({ example: ['AANWIJZING', 'APPROVE'] })
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