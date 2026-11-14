export type BusinessColumns = 1 | 2 | 3;

export const BUSINESS_COLUMNS_KEY = "home-business-columns";
export const DEFAULT_BUSINESS_COLUMNS: BusinessColumns = 2;

export function parseBusinessColumns(value: string | null): BusinessColumns {
  if (value === "1") return 1;
  if (value === "3") return 3;
  return DEFAULT_BUSINESS_COLUMNS;
}
