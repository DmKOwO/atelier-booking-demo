import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import {
  api,
  calendarDownload,
  dateLabel,
  type Appointment,
} from "../lib/booking";
import { servicePrice, studio } from "../data/studio";

import { useCatalog, imageUrl } from "../lib/catalog";
export default function Appointments({
  initialToken,
  onBook,
  notify,
}: {
  initialToken?: string;
  onBook: () => void;
  notify: (value: string) => void;
}) {
  const { looks, masters, branches } = useCatalog();
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    let active = true;
    let saved: string[] = [];
    try {
      const values: unknown = JSON.parse(
        localStorage.getItem("deesse-appointments-v1") || "[]",
      );
      if (Array.isArray(values))
        saved = values.filter(
          (entry): entry is string =>
            typeof entry === "string" && /^[a-zA-Z0-9_-]{43}$/.test(entry),
        );
    } catch {
      /* Нет сохранённых карточек. */
    }
    const tokens = [
      ...new Set([...(initialToken ? [initialToken] : []), ...saved]),
    ];
    setLoading(true);
    setError("");
    Promise.allSettled(
      tokens.map((token) => api<Appointment>("/bookings/" + token)),
    ).then((results) => {
      if (!active) return;
      const valid = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      setItems(valid.sort((a, b) => a.startAt.localeCompare(b.startAt)));
      if (results.some((result) => result.status === "rejected"))
        setError(
          "Часть карточек не удалось загрузить. Попробуйте обновить список.",
        );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [refresh, initialToken]);
  async function cancel(item: Appointment) {
    setBusy(item.id);
    setError("");
    try {
      const updated = await api<Appointment>(
        "/bookings/" + item.token + "/cancel",
        { method: "POST", body: "{}" },
      );
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? updated : entry)),
      );
      setConfirmCancel("");
      notify("Визит отменён. Время снова доступно.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось отменить запись.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="appointments-panel">
      <span className="eyebrow">ВАШИ ПЛАНЫ / АТЕЛЬЕ</span>
      <h2>
        До встречи
        <br />
        <span className="serif">у зеркала.</span>
      </h2>
      <p className="body-muted">
        Всё о визитах в одном месте. Если планы изменятся, отмените запись —
        время освободится для другого гостя.
      </p>
      <div className="appointments-toolbar">
        <span>"Мои визиты"</span>
        <button
          className="text-button"
          onClick={() => setRefresh((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={14} />
          Обновить
        </button>
      </div>
      {error && (
        <p className="reservation-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="availability-loading">
          <LoaderCircle className="spin" size={22} />
          Загружаем ваши визиты…
        </div>
      ) : items.length ? (
        <div className="appointments-list">
          {items.map((item) => {
            const master = masters.find((value) => value.id === item.masterId);
            return (
              <article
                className={
                  "appointment-card " +
                  (item.status === "cancelled" ? "cancelled" : "")
                }
                key={item.id}
              >
                <div className="appointment-card-top">
                  <span>{item.reference}</span>
                  <span
                    className={
                      "booking-status " +
                      (item.status === "cancelled" ? "cancelled" : "")
                    }
                  >
                    {item.status === "confirmed" ? (
                      <>
                        <Check size={11} />В расписании
                      </>
                    ) : (
                      <>
                        <X size={11} />
                        Отменена
                      </>
                    )}
                  </span>
                </div>
                <div className="appointment-card-date">
                  <strong>{dateLabel(item.date)}</strong>
                  <span>
                    {item.time} <small>— {item.endTime}</small>
                  </span>
                </div>
                <div className="ticket-master">
                  <span
                    className="appointment-master-initials"
                    aria-hidden="true"
                  >
                    {master?.initials || "HN"}
                  </span>
                  <div>
                    <strong>{item.masterName}</strong>
                    <span>{item.serviceName}</span>
                  </div>
                  <span>{servicePrice(item as any)}</span>
                </div>
                <p className="appointment-branch">
                  {branches.find((b) => b.id === item.branchId)?.name}
                </p>
                {item.lookIds.length > 0 && (
                  <div className="ticket-inspo">
                    <div>
                      {item.lookIds.map((id) => {
                        const look = looks.find((value) => value.id === id);
                        return (
                          look && (
                            <img
                              key={id}
                              src={imageUrl(look.image, 480)}
                              alt={look.title}
                              width={31}
                              height={38}
                            />
                          )
                        );
                      })}
                    </div>
                    <span>Подборка для мастера</span>
                  </div>
                )}
                {item.status === "confirmed" && (
                  <div className="appointment-card-actions">
                    <button
                      className="text-button"
                      onClick={() => calendarDownload(item)}
                    >
                      <CalendarDays size={15} />В календарь
                    </button>
                    <button
                      className="text-button cancel-visit-button"
                      onClick={() =>
                        setConfirmCancel(
                          confirmCancel === item.id ? "" : item.id,
                        )
                      }
                    >
                      Отменить визит
                    </button>
                  </div>
                )}
                {confirmCancel === item.id && (
                  <div className="cancel-confirmation">
                    <p>
                      Отменить запись на {dateLabel(item.date)}, {item.time}?
                      Время вернётся в общий календарь.
                    </p>
                    <div>
                      <button
                        className="text-button"
                        onClick={() => setConfirmCancel("")}
                      >
                        Оставить запись
                      </button>
                      <button
                        className="button button-blue"
                        disabled={busy === item.id}
                        onClick={() => cancel(item)}
                      >
                        {busy === item.id ? "Отменяем…" : "Да, отменить"}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <CalendarDays size={36} strokeWidth={1.3} />
          <h3>Ваш первый визит впереди.</h3>
          <p>
            Выберите услугу, мастера и удобное время. Карточка появится здесь
            после записи.
          </p>
          <button className="button button-blue" onClick={onBook}>
            Выбрать время <ArrowRight size={18} />
          </button>
        </div>
      )}
      {items.length > 0 && (
        <button className="button button-blue full-width" onClick={onBook}>
          Запланировать ещё один визит <ArrowRight size={18} />
        </button>
      )}
      <p className="fine-print">
        <Clock3 size={11} /> Время указано по часовому поясу студии. Доступ к
        карточкам хранится в этом браузере.
      </p>
    </div>
  );
}
