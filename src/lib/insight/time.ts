export const REPORT_TIME_ZONE = "Asia/Shanghai";

export function formatReportDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export function formatReportDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatReportDateTimeCompact(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}
