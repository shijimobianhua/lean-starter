import Dexie, { type Table } from "dexie";
import { snapshot, type Snapshot } from "./records";
import { APP_VERSION } from "./version";
export { APP_VERSION } from "./version";
export interface Checkpoint {
  id: string;
  createdAt: number;
  reason: string;
  version: string;
  signature: string;
  count: number;
  data: Snapshot;
}
class RecoveryDatabase extends Dexie {
  checkpoints!: Table<Checkpoint, string>;
  settings!: Table<{ id: string; value: unknown }, string>;
  constructor() {
    super("form-daily-recovery");
    this.version(1).stores({ checkpoints: "id,createdAt", settings: "id" });
  }
}
export const recoveryDb = new RecoveryDatabase();
export const recordCount = (d: Snapshot) =>
  d.weights.length +
  d.water.length +
  d.sleep.length +
  d.training.length +
  d.photos.length +
  d.quotes.length;
export const hasData = (d: Snapshot) =>
  recordCount(d) > 0 ||
  !!(
    d.profile?.onboardingDone ||
    d.profile?.heightCm ||
    d.profile?.gender ||
    d.profile?.chestCm ||
    d.profile?.waistCm ||
    d.profile?.hipCm
  );
export function dataSignature(d: Snapshot) {
  return JSON.stringify({
    ...d,
    dailyQuotes: undefined,
    photos: d.photos.map((p) => ({
      id: p.id,
      date: p.date,
      createdAt: p.createdAt,
      size: p.image.size,
      type: p.image.type,
    })),
  });
}
export function announceProtection() {
  window.dispatchEvent(new Event("daily-protection-change"));
}
export async function getSetting<T>(id: string) {
  return (await recoveryDb.settings.get(id))?.value as T | undefined;
}
export async function setSetting(id: string, value: unknown) {
  await recoveryDb.settings.put({ id, value });
  announceProtection();
}
export async function listCheckpoints() {
  return recoveryDb.checkpoints.orderBy("createdAt").reverse().toArray();
}
export async function createCheckpoint(reason: string, data?: Snapshot) {
  const d = data ?? (await snapshot());
  if (!hasData(d)) return undefined;
  const signature = dataSignature(d);
  const row = await recoveryDb.transaction(
    "rw",
    recoveryDb.checkpoints,
    async () => {
      const latest = await recoveryDb.checkpoints.orderBy("createdAt").last();
      // Never replace the last useful history with an empty-profile snapshot.
      if (recordCount(d) === 0 && latest && latest.count > 0) return latest;
      if (latest?.signature === signature && latest.version === APP_VERSION)
        return latest;
      const next: Checkpoint = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        reason,
        version: APP_VERSION,
        signature,
        count: recordCount(d),
        data: d,
      };
      await recoveryDb.checkpoints.put(next);
      const older = (
        await recoveryDb.checkpoints
          .orderBy("createdAt")
          .reverse()
          .primaryKeys()
      ).slice(3);
      if (older.length) await recoveryDb.checkpoints.bulkDelete(older);
      return next;
    },
  );
  try {
    if (recordCount(d) > 0)
      localStorage.setItem("daily-last-record-count", String(recordCount(d)));
  } catch {}
  announceProtection();
  return row;
}
export async function requestPersistence() {
  const manager = navigator.storage;
  if (!manager?.persist) return false;
  return manager.persist();
}
