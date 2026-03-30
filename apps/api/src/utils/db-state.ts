let dbAvailable = true;
let dbStatusMessage = "ok";

export function markDbUnavailable(message: string) {
  dbAvailable = false;
  dbStatusMessage = message;
}

export function markDbAvailable() {
  dbAvailable = true;
  dbStatusMessage = "ok";
}

export function isDbAvailable() {
  return dbAvailable;
}

export function getDbStatusMessage() {
  return dbStatusMessage;
}
