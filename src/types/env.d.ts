declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: 'development' | 'production' | 'test';
    PORT?: string;
    DATABASE_URL: string;
    JWT_SECRET?: string;
    GSHEETS_SPREADSHEET_ID?: string;
    GSHEETS_SUMMARY_SHEET_NAME?: string;
    GSHEETS_DETAIL_SHEET_NAME?: string;
    // Backward-compatible aliases (as used by your .env)
    GOOGLE_SPREADSHEET_ID?: string;
    GOOGLE_SUMMARY_SHEET_NAME?: string;
    GOOGLE_DETAIL_SHEET_NAME?: string;
  }
}
