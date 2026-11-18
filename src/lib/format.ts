export function dateLabel(
  value: string | Date = new Date(),
  timezone = "Asia/Hebron",
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
  },
) {
  const dateOnly =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat("ar-PS", {
    ...options,
    timeZone: dateOnly ? "UTC" : timezone,
  }).format(new Date(dateOnly ? `${value}T12:00:00Z` : value));
}
export function localDay(timezone = "Asia/Hebron", date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function number(value: number) {
  return new Intl.NumberFormat("ar-PS").format(value);
}
