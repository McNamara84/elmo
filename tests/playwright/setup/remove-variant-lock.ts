import { unlinkSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../utils/constants';

const LOCK_FILES = ['playwright_variant_lock.php', 'playwright-variant-lock.php'];

/**
 * Deletes the variant lock files written by applyVariantSettings.
 * A leftover lock keeps the last Playwright variant active on the next page load.
 */
export default function removeVariantLock(): void {
  for (const name of LOCK_FILES) {
    const filePath = path.join(REPO_ROOT, name);
    try {
      unlinkSync(filePath);
      console.log(`[variant-teardown] Removed ${name}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
