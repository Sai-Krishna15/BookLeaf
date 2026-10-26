import { prepareTestDatabase } from '../scripts/test-db';

// Runs once before all test files: safety check, migrate and seed the TEST database.
export default async function setup(): Promise<void> {
  await prepareTestDatabase((m) => console.log(`[test-db] ${m}`));
}
