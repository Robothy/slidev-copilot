import * as path from 'path';
import { glob } from 'glob';

/**
 * This file is maintained for backward compatibility.
 * For running tests, use `vitest` CLI instead of this custom runner.
 */
export function run(): Promise<void> {
  console.log('Using Vitest for testing. Please run tests with `npm test` or `npm run test:watch`');
  
  return Promise.resolve();
}