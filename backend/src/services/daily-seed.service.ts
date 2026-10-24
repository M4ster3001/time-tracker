import {
  dailySeedRepository,
  getDailySeedRuntimeStatus,
  runDailySeedIfNeeded as runDailySeedIfNeededUseCase,
  dailySeedTestUtils,
} from '../modules/health/index.js';

export { getDailySeedRuntimeStatus };
export const __testOnly = dailySeedTestUtils;
export const runDailySeedIfNeeded = () =>
  runDailySeedIfNeededUseCase({ repository: dailySeedRepository });
