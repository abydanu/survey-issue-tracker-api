export const safeNumberTransform = (val: string | number | null | undefined): number | null => {
    if (val === null || val === undefined || val === '') return null;
    const num = typeof val === 'number' ? val : Number(val);
    return isNaN(num) ? null : num;
  };