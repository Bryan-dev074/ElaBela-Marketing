export const PARAGUAY_TIME_ZONE = "America/Asuncion";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PARAGUAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const paraguayDateKey = (date = new Date()): string => dateFormatter.format(date);

export const utcForParaguayDate = (date: Date): number => {
  const [year, month, day] = paraguayDateKey(date).split("-").map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
};

export const paraguayWeekday = (date = new Date()): number => {
  const weekday = new Date(utcForParaguayDate(date)).getUTCDay();
  return (weekday + 6) % 7;
};
