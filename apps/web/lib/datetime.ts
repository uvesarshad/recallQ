const IST_TIMEZONE = "Asia/Kolkata";

export function defaultReminderHourIST() {
  return 9;
}

export function getCurrentISTTimestamp() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}
