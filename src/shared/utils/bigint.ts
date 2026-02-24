export function serializeBigInt<T>(obj: T): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }

  return obj;
}

export const toBigInt = (val: unknown): bigint => {
  if (val === null || val === undefined || val === '') return BigInt(0);
  const str = String(val).trim();
  if (!str) return BigInt(0);
  const cleaned = str.replace(/\.0+$/, '').replace(/,/g, '');
  if (!/^-?\d+$/.test(cleaned)) return BigInt(0); 
  return BigInt(cleaned);
};
