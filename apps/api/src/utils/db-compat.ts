import { createId } from "@paralleldrive/cuid2";
import { eq, inArray, like, sql } from "drizzle-orm";
import { db, dbProvider } from "@whatsapp-blast/database";

type AnyTable = any;

function ensureRowsWithIds(values: Record<string, any>): Record<string, any>;
function ensureRowsWithIds(values: Record<string, any>[]): Record<string, any>[];
function ensureRowsWithIds(values: Record<string, any> | Record<string, any>[]) {
  if (Array.isArray(values)) {
    return values.map((value) => ({
      id: value.id ?? createId(),
      ...value,
    }));
  }

  return {
    id: values.id ?? createId(),
    ...values,
  };
}

export async function insertReturningOne(table: AnyTable, values: Record<string, any>) {
  const row = ensureRowsWithIds(values);
  await db.insert(table).values(row);
  const [inserted] = await db.select().from(table).where(eq(table.id, row.id)).limit(1);
  return inserted;
}

export async function insertReturningMany(table: AnyTable, values: Record<string, any>[]) {
  const rows = ensureRowsWithIds(values);
  await db.insert(table).values(rows);
  const ids = rows.map((row: Record<string, any>) => row.id);
  if (ids.length === 0) return [];
  return db.select().from(table).where(inArray(table.id, ids));
}

export async function updateReturningOne(table: AnyTable, where: any, values: Record<string, any>) {
  const [existing] = await db.select().from(table).where(where).limit(1);
  if (!existing) return undefined;
  await db.update(table).set(values).where(where);
  const [updated] = await db.select().from(table).where(eq(table.id, existing.id)).limit(1);
  return updated;
}

export async function updateReturningMany(table: AnyTable, where: any, values: Record<string, any>) {
  const existing = await db.select({ id: table.id }).from(table).where(where);
  if (existing.length === 0) return [];
  await db.update(table).set(values).where(where);
  return db.select().from(table).where(inArray(table.id, existing.map((row: any) => row.id)));
}

export async function deleteReturningOne(table: AnyTable, where: any) {
  const [existing] = await db.select().from(table).where(where).limit(1);
  if (!existing) return undefined;
  await db.delete(table).where(where);
  return existing;
}

export async function deleteReturningMany(table: AnyTable, where: any) {
  const existing = await db.select().from(table).where(where);
  if (existing.length === 0) return [];
  await db.delete(table).where(where);
  return existing;
}

export function ciLike(column: any, value: string) {
  const pattern = `%${value.toLowerCase()}%`;
  return like(sql`lower(${column})`, pattern);
}

export const supportsNativeReturning = dbProvider === "postgresql";
export const activeDbProvider: "postgresql" | "mysql" = dbProvider;
