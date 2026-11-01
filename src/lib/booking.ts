export interface Slot {
  id: string;
  masterId: string;
  date: string;
  time: string;
  endTime: string;
  startAt: string;
  endAt: string;
}
export interface Availability {
  timezone: string;
  today: string;
  date: string;
  days: { date: string; count: number }[];
  slots: Slot[];
  masters: {
    id: string;
    nextAvailable: { date: string; time: string } | null;
  }[];
  durationMinutes: number;
  generatedAt: string;
}
export interface Appointment {
  id: string;
  reference: string;
  token: string;
  status: "confirmed" | "cancelled";
  serviceId: string;
  serviceName: string;
  masterId: string;
  masterName: string;
  date: string;
  time: string;
  endTime: string;
  startAt: string;
  endAt: string;
  name: string;
  phone: string;
  note: string;
  lookIds: string[];
  price: number;
  from: boolean;
  priceMax?: number;
  priceOnRequest?: boolean;
  durationMinutes: number;
  branchId?: string;
  createdAt: string;
}
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      data.code || "REQUEST_FAILED",
      data.error || "Не удалось выполнить действие.",
      response.status,
    );
  return data as T;
}
export const dateLabel = (date: string, style: "long" | "short" = "long") =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: style === "long" ? "long" : "short",
  }).format(new Date(`${date}T12:00:00`));
export function rememberAppointment(appointment: Appointment) {
  try {
    const previous: unknown = JSON.parse(
      localStorage.getItem("deesse-appointments-v1") || "[]",
    );
    const list = Array.isArray(previous)
      ? previous.filter((entry) => typeof entry === "string")
      : [];
    localStorage.setItem(
      "deesse-appointments-v1",
      JSON.stringify(
        [
          appointment.token,
          ...list.filter((token) => token !== appointment.token),
        ].slice(0, 20),
      ),
    );
  } catch {
    /* Ссылка всё равно доступна в карточке визита. */
  }
  window.dispatchEvent(new Event("forma:appointment"));
}
export function calendarDownload(appointment: Appointment) {
  const utc = (value: string) =>
    value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const escape = (value: string) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const text = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Forma//Appointments//RU",
    "BEGIN:VEVENT",
    `UID:${appointment.id}@forma.local`,
    `DTSTAMP:${utc(new Date().toISOString())}`,
    `DTSTART:${utc(appointment.startAt)}`,
    `DTEND:${utc(appointment.endAt)}`,
    `SUMMARY:${escape("Ателье — " + appointment.serviceName)}`,
    `DESCRIPTION:${escape("Мастер: " + appointment.masterName + ". Номер записи: " + appointment.reference + ".")}`,
    `LOCATION:${escape("Демонстрация, Адрес в демоверсии не указан")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/calendar;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${appointment.reference}.ics`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
