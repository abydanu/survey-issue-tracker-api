# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Multiple Status Filter**: Filter survey dengan multiple status values sekaligus
  - Endpoint `GET /api/sync` sekarang mendukung multiple `statusJt` parameters
  - **Format Comma-separated (Recommended)**: `?statusJt=APPROVE,GOLIVE,PENDING`
  - **Format Repeat parameter (Alternative)**: `?statusJt=APPROVE&statusJt=GOLIVE&statusJt=PENDING`
  - Backend menggunakan SQL `IN` operator untuk performa optimal
  - Backward compatible dengan single status filter

### Changed
- `DashboardQuery.statusJt` sekarang menerima `string | string[]`
- Controller parsing mendukung:
  - Comma-separated values: `APPROVE,GOLIVE,PENDING`
  - Multiple query parameters: `statusJt=APPROVE&statusJt=GOLIVE`
  - Single value: `statusJt=APPROVE`
- Repository logic diupdate untuk handle single dan multiple values

### Technical Details
- **Files Modified**:
  - `src/modules/survey/domain/sync.entity.ts` - Updated interface
  - `src/modules/survey/presentation/sync.controller.ts` - Updated query parsing with comma-separated support
  - `src/modules/survey/infrastructure/sync.prisma.repository.ts` - Updated filter logic
  - `src/modules/survey/presentation/sync.openapi.ts` - Updated API documentation
  - `README.md` - Added usage examples

## [Previous Versions]
- See git history for previous changes
