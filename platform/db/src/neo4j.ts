/**
 * Neo4j helpers (stubs).
 * Implementations intentionally avoid importing 'neo4j-driver' at this layer to keep platform/db build-light.
 * Apps can provide concrete driver creation or this module can be enhanced later with a peer dependency.
 */

export interface Neo4jDriverLike {
  verifyConnectivity(): Promise<void>;
  close(): Promise<void>;
}

export type CreateDriverOptions = {
  uri: string;
  user: string;
  password: string;
  // Additional options like encryption, trust strategy etc. can be added later
};

/**
 * Placeholder factory that throws until wired with a real driver implementation.
 * Consumers should either:
 * - Provide their own driver and pass to health/close helpers, or
 * - Replace this with a version that dynamically imports 'neo4j-driver' at runtime.
 */
export async function createDriver(_opts: CreateDriverOptions): Promise<Neo4jDriverLike> {
  throw new Error(
    'platform/db: createDriver is not implemented. Provide a driver via apps or extend this module with neo4j-driver.'
  );
}

export async function verifyConnectivity(driver: Neo4jDriverLike): Promise<boolean> {
  try {
    await driver.verifyConnectivity();
    return true;
  } catch {
    return false;
  }
}

export async function closeDriver(driver: Neo4jDriverLike): Promise<void> {
  await driver.close();
}