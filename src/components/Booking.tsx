import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  LoaderCircle,
  Plus,
  Scissors,
  UserRound,
  X,
} from "lucide-react";
import { audiences, servicePrice, studio, type Audience } from "../data/studio";
import { useCatalog, imageUrl } from "../lib/catalog";
import ReceiptTicket from "./ReceiptTicket";
import {
  api,
  ApiError,
  dateLabel,
  rememberAppointment,
  type Appointment,
  type Availability,
  type Slot,
} from "../lib/booking";

export interface BookingOptions {
  serviceId?: string;
  masterId?: string;
  lookIds?: string[];
  branchId?: string;
}
const newKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(20)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
const steps = ["Услуга", "Мастер и время", "Ваши данные"];

export default function Booking({
  options,
  saved,
  notify,
  onAppointments,
}: {
  options: BookingOptions;
  saved: string[];
  notify: (message: string) => void;
  onAppointments: () => void;
}) {
  const { services, masters, looks, branches } = useCatalog();
  const initial =
    services.find((item) => item.id === options.serviceId) ?? services[0];
  const [step, setStep] = useState(options.serviceId ? 1 : 0);
  const [audience, setAudience] = useState<Audience>(initial.audience);
  const [serviceId, setServiceId] = useState(initial.id);
  const [masterId, setMasterId] = useState(
    options.masterId &&
      masters
        .find((master) => master.id === options.masterId)
        ?.serviceIds.includes(initial.id)
      ? options.masterId
      : "any",
  );
  const [requestedDate, setRequestedDate] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [dateOffset, setDateOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [lookIds, setLookIds] = useState<string[]>(
    [...new Set([...(options.lookIds ?? []), ...saved])].filter((id) =>
      looks.some((look) => look.id === id),
    ),
  );
  const [serviceSearch, setServiceSearch] = useState("");
  const [chooseLooks, setChooseLooks] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [branchId, setBranchId] = useState(
    options.branchId || branches[0]?.id || "tolstogo",
  );
  const requestKey = useRef<string | null>(null);
  const service = services.find((item) => item.id === serviceId)!;
  const compatible = masters.filter(
    (master) =>
      master.serviceIds.includes(serviceId) &&
      (!master.branchIds || master.branchIds.includes(branchId)),
  );
  const selectedMaster = masters.find(
    (master) => master.id === (slot?.masterId ?? masterId),
  );
  const selectedLooks = looks.filter((look) => lookIds.includes(look.id));
  const date = requestedDate || availability?.date || "";
  const uniqueSlots = useMemo(
    () =>
      Array.from(
        new Map(
          (availability?.slots ?? []).map((item) => [item.time, item]),
        ).values(),
      ),
    [availability],
  );
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setAvailability(null);
    const params = new URLSearchParams({
      serviceId,
      masterId,
      branchId,
      ...(requestedDate ? { date: requestedDate } : {}),
    });
    api<Availability>("/availability?" + params, { signal: controller.signal })
      .then((result) => {
        setAvailability(result);
        if (!requestedDate)
          setDateOffset(
            Math.max(
              0,
              Math.floor(
                result.days.findIndex((day) => day.date === result.date) / 7,
              ) * 7,
            ),
          );
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof TypeError
              ? "Не удалось загрузить расписание. Проверьте соединение и попробуйте ещё раз."
              : cause.message,
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [serviceId, masterId, branchId, requestedDate, refresh]);

  function nextStep(value: number) {
    setStep(value);
    setError("");
    requestAnimationFrame(() => {
      stageRef.current
        ?.closest("dialog")
        ?.scrollTo({ top: 0, behavior: "instant" });
      stageRef.current?.focus({ preventScroll: true });
    });
  }
  function changeService(id: string) {
    setServiceId(id);
    setSlot(null);
    setRequestedDate("");
    requestKey.current = null;
    if (
      masterId !== "any" &&
      !masters.find((master) => master.id === masterId)?.serviceIds.includes(id)
    )
      setMasterId("any");
  }
  function toggleLook(id: string) {
    requestKey.current = null;
    setLookIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot || submitting) return;
    setSubmitting(true);
    setError("");
    requestKey.current ??= newKey();
    try {
      const result = await api<Appointment>("/bookings", {
        method: "POST",
        body: JSON.stringify({
          serviceId,
          masterId: slot.masterId,
          date: slot.date,
          time: slot.time,
          name,
          phone,
          note,
          lookIds,
          branchId,
          requestKey: requestKey.current,
        }),
      });
      rememberAppointment(result);
      setAppointment(result);
      notify("Запись оформлена! Чек визита готов.");
      requestAnimationFrame(() =>
        stageRef.current
          ?.closest("dialog")
          ?.scrollTo({ top: 0, behavior: "instant" }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось сохранить запись.",
      );
      if (cause instanceof ApiError && cause.code === "SLOT_TAKEN") {
        setError("");
        setConflict(cause.message);
        setSlot(null);
        setStep(1);
        setRefresh((value) => value + 1);
        requestKey.current = null;
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (appointment)
    return (
      <div className="reservation-success" ref={stageRef}>
        <div className="success-mark">
          <CheckCheck size={32} strokeWidth={1.5} />
        </div>
        <span className="eyebrow">
          "ДО ВСТРЕЧИ В АТЕЛЬЕ"
        </span>
        <h2>"Вы записаны."</h2>
        <p>
          Время сохранено в календаре. Сохраните карточку визита. Она доступна в
          разделе «Мои записи».
        </p>
        <ReceiptTicket
          appointment={appointment}
          branchId={appointment.branchId || branchId}
          notify={notify}
        />
        <div className="success-actions" style={{ marginTop: "24px" }}>
          <button className="button button-outline" onClick={onAppointments}>
            Мои записи <ArrowRight size={17} />
          </button>
        </div>
      </div>
    );

  return (
    <div className="reservation">

      <div className="branch-picker" aria-label="Филиал">
        {branches.map((b) => (
          <button
            key={b.id}
            type="button"
            aria-pressed={branchId === b.id}
            className={branchId === b.id ? "selected" : ""}
            onClick={() => {
              setBranchId(b.id);
              setSlot(null);
              setMasterId("any");
              setRequestedDate("");
              requestKey.current = null;
              if (step === 2) setStep(1);
            }}
          >
            {b.name}
          </button>
        ))}
      </div>
      <div className="reservation-head" ref={stageRef} tabIndex={-1}>
        <span className="eyebrow">ОНЛАЙН-ЗАПИСЬ / АТЕЛЬЕ</span>
        <h2>
          {step === 0
            ? "Что сделаем сегодня?"
            : step === 1
              ? "Найдём ваш момент."
              : "Уже почти знакомы."}
        </h2>
        <p>
          {step === 0
            ? "Выберите услугу — дальше покажем мастеров и свободное время."
            : step === 1
              ? "Выберите специалиста, день и удобное свободное окно."
              : "Оставьте контакт, чтобы студия могла связаться с вами."}
        </p>
      </div>
      <nav className="reservation-steps" aria-label="Шаги записи">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            className={
              step === index ? "current" : step > index ? "complete" : ""
            }
            aria-current={step === index ? "step" : undefined}
            disabled={index > step}
            onClick={() => nextStep(index)}
          >
            <span>
              {step > index ? <Check size={13} /> : "0" + (index + 1)}
            </span>
            {label}
          </button>
        ))}
      </nav>
      <div className="reservation-layout">
        <div className="reservation-main">
          {conflict && (
            <div className="reservation-error" role="alert">
              {conflict}
            </div>
          )}
          {error && (
            <div className="reservation-error" role="alert">
              {error}
              {step === 1 && (
                <button onClick={() => setRefresh((value) => value + 1)}>
                  Обновить расписание <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}
          {step === 0 && (
            <div className="service-picker">
              <div className="segmented-control booking-audience">
                {audiences
                  .filter(
                    (item) =>
                      item.id !== "all" &&
                      services.some((s) => s.audience === item.id),
                  )
                  .map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={item.id === audience ? "active" : ""}
                      aria-pressed={item.id === audience}
                      onClick={() => {
                        setAudience(item.id);
                        setServiceSearch("");
                        changeService(
                          services.find((value) => value.audience === item.id)!
                            .id,
                        );
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
              </div>
              <label className="booking-service-search">
                Найти услугу
                <input
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Например, окрашивание"
                />
              </label>
              <fieldset className="service-options">
                <legend className="sr-only">Выберите услугу</legend>
                {services
                  .filter(
                    (item) =>
                      item.audience === audience &&
                      item.name
                        .toLowerCase()
                        .includes(serviceSearch.toLowerCase()),
                  )
                  .map((item) => (
                    <label
                      className={
                        "service-option " +
                        (serviceId === item.id ? "selected" : "")
                      }
                      key={item.id}
                    >
                      <input
                        type="radio"
                        name="service"
                        value={item.id}
                        checked={serviceId === item.id}
                        onChange={() => changeService(item.id)}
                      />
                      <span className="service-option-check">
                        {serviceId === item.id ? <Check size={13} /> : null}
                      </span>
                      <span className="service-option-copy">
                        <strong>{item.name}</strong>
                        <small>{item.detail}</small>
                        <span>
                          <Clock3 size={12} />
                          {item.durationMinutes} мин
                        </span>
                      </span>
                      <span className="service-option-price">
                        {servicePrice(item)}
                      </span>
                    </label>
                  ))}
              </fieldset>
              <div className="reservation-help">
                <Scissors size={19} />
                <p>
                  Любая стрижка начинается с разговора. Если сомневаетесь в
                  форме, мастер поможет определиться на месте.
                </p>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="time-picker">
              <div className="picker-section-title">
                <h3>Кому доверим форму?</h3>
                <span>Только подходящие специалисты</span>
              </div>
              <div
                className="booking-master-grid"
                role="group"
                aria-label="Выбор мастера"
              >
                <button
                  type="button"
                  className={
                    "booking-master-card any-master " +
                    (masterId === "any" ? "selected" : "")
                  }
                  aria-pressed={masterId === "any"}
                  onClick={() => {
                    setMasterId("any");
                    setSlot(null);
                    requestKey.current = null;
                  }}
                >
                  <span className="any-master-icon">
                    <Clock3 size={24} strokeWidth={1.5} />
                  </span>
                  <strong>Любой свободный</strong>
                  <small>Больше вариантов времени</small>
                  {masterId === "any" && (
                    <span className="master-selected">
                      <Check size={11} />
                    </span>
                  )}
                </button>
                {compatible.map((master) => (
                  <button
                    key={master.id}
                    type="button"
                    className={
                      "booking-master-card " +
                      (masterId === master.id ? "selected" : "")
                    }
                    aria-pressed={masterId === master.id}
                    onClick={() => {
                      setMasterId(master.id);
                      setSlot(null);
                      requestKey.current = null;
                    }}
                  >
                    <span
                      className="booking-master-initials"
                      aria-hidden="true"
                    >
                      {master.initials}
                    </span>
                    <strong>{master.name}</strong>
                    <small>{master.role.split("·")[0].trim()}</small>
                    {masterId === master.id && (
                      <span className="master-selected">
                        <Check size={11} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="picker-section-title date-picker-title">
                <h3>Выберите день</h3>
                <div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Предыдущие даты"
                    disabled={dateOffset === 0}
                    onClick={() => setDateOffset(Math.max(0, dateOffset - 7))}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Следующие даты"
                    disabled={
                      dateOffset >= (availability?.days.length ?? 28) - 7
                    }
                    onClick={() => setDateOffset(dateOffset + 7)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
              {availability && (
                <>
                  <span className="calendar-month" id="booking-month">
                    {new Intl.DateTimeFormat("ru-RU", {
                      month: "long",
                      year: "numeric",
                    }).format(
                      new Date(
                        (availability.days[dateOffset]?.date || date) +
                          "T12:00:00",
                      ),
                    )}
                  </span>
                  <div className="booking-days" aria-label="Даты записи">
                    {availability.days
                      .slice(dateOffset, dateOffset + 7)
                      .map((day) => (
                        <button
                          type="button"
                          key={day.date}
                          aria-describedby="booking-month"
                          aria-pressed={day.date === date}
                          disabled={!day.count || loading}
                          className={day.date === date ? "selected" : ""}
                          onClick={() => {
                            setRequestedDate(day.date);
                            setSlot(null);
                            requestKey.current = null;
                          }}
                        >
                          <span>
                            {new Intl.DateTimeFormat("ru-RU", {
                              weekday: "short",
                            }).format(new Date(day.date + "T12:00:00"))}
                          </span>
                          <strong>{Number(day.date.slice(8))}</strong>
                          <small>
                            {day.date === availability.today
                              ? "сегодня"
                              : day.count
                                ? dateLabel(day.date, "short")
                                    .split(" ")
                                    .slice(1)
                                    .join(" ")
                                : "нет окон"}
                          </small>
                        </button>
                      ))}
                  </div>
                </>
              )}
              <div className="picker-section-title times-title">
                <h3>Свободное время{date ? " · " + dateLabel(date) : ""}</h3>
                {loading && (
                  <LoaderCircle
                    className="spin"
                    size={16}
                    aria-label="Загрузка расписания"
                  />
                )}
              </div>
              {!availability && loading && (
                <div className="availability-loading">
                  <LoaderCircle className="spin" size={23} />
                  <span>Сверяем расписание мастеров…</span>
                </div>
              )}
              <div
                className={
                  "booking-time-groups " + (loading ? "is-loading" : "")
                }
                aria-busy={loading}
              >
                {[
                  { title: "Утро", min: 0, max: 12 },
                  { title: "День", min: 12, max: 17 },
                  { title: "Вечер", min: 17, max: 24 },
                ].map((group) => {
                  const times = uniqueSlots.filter(
                    (item) =>
                      Number(item.time.slice(0, 2)) >= group.min &&
                      Number(item.time.slice(0, 2)) < group.max,
                  );
                  return (
                    times.length > 0 && (
                      <div className="booking-time-group" key={group.title}>
                        <span>{group.title}</span>
                        <div>
                          {times.map((item) => (
                            <button
                              type="button"
                              key={item.id}
                              disabled={loading}
                              aria-pressed={slot?.id === item.id}
                              className={slot?.id === item.id ? "selected" : ""}
                              onClick={() => {
                                setSlot(item);
                                setConflict("");
                                requestKey.current = null;
                              }}
                            >
                              {item.time}
                              {slot?.id === item.id && <Check size={11} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  );
                })}
                {availability && !uniqueSlots.length && !loading && (
                  <div className="empty-time">
                    <CalendarDays size={27} />
                    <strong>На этот день всё занято.</strong>
                    <p>
                      Посмотрите соседние даты или выберите другого мастера.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => {
                        setRequestedDate("");
                        setSlot(null);
                        setRefresh((value) => value + 1);
                      }}
                    >
                      Найти ближайшее время <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </div>
              <div className="availability-note">
                <Clock3 size={13} />
                <span>
                  Услуга займёт {service.durationMinutes} мин. Время — по{" "}
                  {studio.city === "Демонстрация"
                    ? "Демонстрацияу"
                    : "часовому поясу студии"}
                  . Окна учитывают всю длительность визита.
                </span>
              </div>
              {slot && masterId === "any" && (
                <div className="auto-master-note">
                  <Check size={14} />
                  На {slot.time} вас примет {selectedMaster?.name}. Специалист
                  будет указан в записи.
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <form
              id="reservation-form"
              onSubmit={submit}
              className="reservation-contact"
            >
              <div className="selected-appointment">
                <CalendarDays size={21} />
                <div>
                  <strong>
                    {slot ? dateLabel(slot.date) + ", " + slot.time : ""}
                  </strong>
                  <span>
                    {service.name} · {selectedMaster?.name} ·{" "}
                    {service.durationMinutes} мин
                  </span>
                </div>
                <button type="button" onClick={() => nextStep(1)}>
                  Изменить
                </button>
              </div>

              <div className="reservation-contact-fields">
                <label htmlFor="reservation-name">
                  Как вас зовут
                  <input
                    id="reservation-name"
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="given-name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      requestKey.current = null;
                    }}
                    placeholder="Ваше имя"
                  />
                </label>
                <label htmlFor="reservation-phone">
                  Номер телефона
                  <input
                    id="reservation-phone"
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={24}
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      requestKey.current = null;
                    }}
                    placeholder="+7 700 000 00 00"
                  />
                </label>
              </div>
              <label
                htmlFor="reservation-note"
                className="reservation-note-label"
              >
                Пожелания <span>необязательно</span>
                <textarea
                  id="reservation-note"
                  rows={3}
                  maxLength={1000}
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                    requestKey.current = null;
                  }}
                  placeholder="Что хочется изменить? Что важно учесть мастеру?"
                />
              </label>
              <div className="booking-inspiration">
                <div className="picker-section-title">
                  <h3>
                    Ваше вдохновение{" "}
                    <span>
                      {selectedLooks.length.toString().padStart(2, "0")}
                    </span>
                  </h3>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setChooseLooks(!chooseLooks)}
                  >
                    {chooseLooks
                      ? "Готово"
                      : selectedLooks.length
                        ? "Изменить"
                        : "Добавить образы"}
                    <Plus size={15} />
                  </button>
                </div>
                {selectedLooks.length > 0 && (
                  <div className="inspiration-thumbnails">
                    {selectedLooks.map((look) => (
                      <button
                        type="button"
                        key={look.id}
                        onClick={() => toggleLook(look.id)}
                        aria-label={"Убрать пример «" + look.title + "»"}
                      >
                        <img
                          src={imageUrl(look.image, 480)}
                          alt={look.title}
                          width={70}
                          height={84}
                        />
                        <span>
                          <X size={11} />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {chooseLooks && (
                  <div
                    className="inspiration-chooser"
                    aria-label="Образы для записи"
                  >
                    {looks.map((look) => (
                      <button
                        type="button"
                        key={look.id}
                        aria-pressed={lookIds.includes(look.id)}
                        aria-label={"Прикрепить «" + look.title + "»"}
                        onClick={() => toggleLook(look.id)}
                      >
                        <img
                          src={imageUrl(look.image, 480)}
                          alt=""
                          width={80}
                          height={96}
                        />
                        <span>{look.title}</span>
                        {lookIds.includes(look.id) && (
                          <i>
                            <Check size={12} />
                          </i>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <p>
                  Примеры увидит мастер. На встрече обсудите, как адаптировать
                  форму под ваши волосы.
                </p>
              </div>
              <label className="booking-consent">
                <input type="checkbox" required />
                Согласен на обработку имени, телефона и пожеланий для оформления
                визита.
              </label>
              <p className="reservation-contact-note">
                Телефон нужен для связи по визиту. Регистрация и оплата на сайте
                не требуются.
                ""
              </p>
            </form>
          )}
        </div>
        <aside className="reservation-summary" aria-label="Ваша запись">
          <div className="reservation-summary-body">
            <span className="eyebrow">СОБИРАЕМ ВАШ ВИЗИТ</span>
            <h3>{service.name}</h3>
            <div className="summary-fact">
              <UserRound size={15} />
              <span>{selectedMaster?.name || "Любой свободный мастер"}</span>
            </div>
            <div className="summary-fact">
              <Clock3 size={15} />
              <span>{service.durationMinutes} мин · консультация включена</span>
            </div>
            <div className={"summary-date " + (slot ? "has-date" : "")}>
              <CalendarDays size={18} />
              <div>
                <strong>
                  {slot ? dateLabel(slot.date) : "Выберите день и время"}
                </strong>
                <span>
                  {slot
                    ? slot.time + " — " + slot.endTime
                    : "Покажем свободные окна мастера"}
                </span>
              </div>
              {slot && <Check size={16} />}
            </div>
            {selectedLooks.length > 0 && (
              <div className="summary-inspo">
                <div>
                  {selectedLooks.slice(0, 3).map((look) => (
                    <img
                      key={look.id}
                      src={imageUrl(look.image, 480)}
                      alt=""
                      width={29}
                      height={35}
                    />
                  ))}
                </div>
                <span>Образов: {selectedLooks.length}</span>
                <Heart size={13} />
              </div>
            )}
            <div className="summary-price">
              <span>{service.from ? "Стоимость от" : "Стоимость"}</span>
              <strong>{servicePrice(service)}</strong>
            </div>
            {service.from && (
              <p className="summary-price-note">
                Итоговую стоимость согласуем до начала работы.
              </p>
            )}
          </div>
        </aside>
      </div>
      <footer className="reservation-footer">
        <div>
          {step > 0 ? (
            <button
              type="button"
              className="text-button"
              onClick={() => nextStep(step - 1)}
              disabled={submitting}
            >
              <ArrowLeft size={16} />
              Назад
            </button>
          ) : (
            <span className="reservation-footer-note">
              Всё нужное — за три шага
            </span>
          )}
          <span className="reservation-mobile-price">
            {servicePrice(service)}
          </span>
        </div>
        {step === 0 ? (
          <button
            type="button"
            className="button button-blue"
            onClick={() => nextStep(1)}
          >
            Мастер и время <ArrowRight size={19} />
          </button>
        ) : step === 1 ? (
          <button
            type="button"
            className="button button-blue"
            disabled={!slot || loading}
            onClick={() => nextStep(2)}
          >
            {slot ? "Дальше · " + slot.time : "Выберите время"}
            <ArrowRight size={19} />
          </button>
        ) : (
          <button
            type="submit"
            form="reservation-form"
            className="button button-blue"
            disabled={submitting || !slot}
          >
            {submitting ? (
              <>
                <LoaderCircle className="spin" size={17} />
                Сохраняем…
              </>
            ) : (
              <>
                Записаться на {slot?.time}
                <ArrowUpRight size={19} />
              </>
            )}
          </button>
        )}
      </footer>
    </div>
  );
}
