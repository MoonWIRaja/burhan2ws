import { markDbAvailable, markDbUnavailable } from "./db-state.js";

export function isBlockedDbError(error: any): boolean {
  return (
    error?.code === "ER_HOST_IS_BLOCKED" ||
    (typeof error?.sqlMessage === "string" &&
      error.sqlMessage.includes("Host") &&
      error.sqlMessage.includes("blocked")) ||
    (typeof error?.message === "string" &&
      (error.message.includes("ER_HOST_IS_BLOCKED") || error.message.includes("flush-hosts")))
  );
}

export function handleDbError(error: any, context: string): boolean {
  if (!isBlockedDbError(error)) {
    markDbAvailable();
    return false;
  }

  const message = "Database host is temporarily blocked by the upstream MySQL server";
  markDbUnavailable(message);
  console.error(`[${context}] ${message}:`, error?.sqlMessage || error?.message || error);
  return true;
}

export function sendDbUnavailable(res: any) {
  return res.status(503).json({
    error: "Database temporarily unavailable",
    code: "DB_HOST_BLOCKED",
    message: "The upstream MySQL host is temporarily blocked. Please retry later or switch provider.",
  });
}
