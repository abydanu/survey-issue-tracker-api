import { z as zod, ZodError } from 'zod';
import { extendZodWithOpenApi } from '@hono/zod-openapi';
import type { Context } from 'hono';

extendZodWithOpenApi(zod);

zod.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case 'too_small':
      if (issue.type === 'string') {
        return { message: `Minimal ${issue.minimum} karakter` };
      }
      return { message: 'Nilai terlalu kecil' };

    case 'invalid_string':
      if (issue.validation === 'email') {
        return { message: 'Format email tidak valid' };
      }
      return { message: 'Format tidak valid' };

    case 'invalid_type':
      return { message: 'Field wajib diisi atau Tipe Data tidak sesuai' };

    default:
      return { message: ctx.defaultError };
  }
});

export const z = zod;

export function formatZodError(error: ZodError) {
  return error.issues.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));
}

export function createZodErrorHook() {
  return (result: { success: boolean; error?: ZodError }, c: Context) => {
    if (!result.success) {
      const error = result.error;
      if (error instanceof ZodError) {
        return c.json({
          success: "false",
          message: "Error Validation",
          errors: formatZodError(error),
        }, 400);
      }
      
      return c.json({
        success: "false",
        message: "Error Validation",
        errors: [{ field: "unknown", message: "Validation failed" }],
      }, 400);
    }
  };
}
