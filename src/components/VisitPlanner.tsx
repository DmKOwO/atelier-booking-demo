import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  Clock3,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useCatalog, imageUrl } from "../lib/catalog";
import {
  api,
  ApiError,
  dateLabel,
  rememberAppointment,
  type Appointment,
  type Availability,
  type Slot,
} from "../lib/booking";
import { recommendations, visitTotal, mergeVisitService } from "../lib/visit";
import { servicePrice, type Service } from "../data/studio";
import ReceiptTicket from "./ReceiptTicket";

type Selection = Slot & { serviceId: string };
function TimePicker({
  service,
  date,
  branchId,
  selected,
  earlier,
  onSelect,
  onInitialDate,
  onReset,
  refresh,
}: {
  service: Service;
  date: string;
  branchId: string;
  selected?: Selection;
  earlier: Selection[];
  onSelect: (s: Selection) => void;
  onInitialDate: (date: string) => void;
  onReset: () => void;
  refresh: number;
}) {
  const { masters } = useCatalog();
  const [master, setMaster] = useState("any"),
    [data, setData] = useState<Availability | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    const params = new URLSearchParams({
      serviceId: service.id,
      branchId,
      masterId: master,
      ...(date ? { date } : {}),
    });
    api<Availability>("/availability?" + params, { signal: controller.signal })
      .then((d) => {
        setData(d);
        if (!date) onInitialDate(d.date);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [service.id, date, branchId, master, refresh]);

  const slots = [
    ...new Map(
      (data?.slots || [])
        .filter((s) => earlier.every((other) => Date.parse(s.endAt) + 15 * 60000 <= Date.parse(other.startAt) || Date.parse(s.startAt) >= Date.parse(other.endAt) + 15 * 60000))
        .map((s) => [s.time, s]),
    ).values(),
  ];
  return (
    <div className={`vp-time-card ${selected ? "has-selection" : ""}`}>
      <header>
        <div>
          <h3>{service.name}</h3>
          <p>
            {service.durationMinutes} мин · {servicePrice(service)}
          </p>
        </div>
        {selected && <Check size={20} />}
      </header>
      <label className="vp-master-select">
        Дата этой процедуры
        <input type="date" aria-label={"Дата для " + service.name} value={date} onChange={(e) => { onInitialDate(e.target.value); onReset(); }} />
      </label>
      <label className="vp-master-select">
        Специалист
        <select
          aria-label={"Мастер для " + service.name}
          value={master}
          onChange={(e) => {
            setMaster(e.target.value);
            onReset();
          }}
        >
          <option value="any">Любой подходящий мастер</option>
          {masters
            .filter(
              (m) =>
                m.serviceIds.includes(service.id) &&
                (!m.branchIds || m.branchIds.includes(branchId)),
            )
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
      </label>
      {loading ? (
        <p className="vp-loading">
          <LoaderCircle className="spin" size={18} />
          Проверяем свободное время…
        </p>
      ) : error ? (
        <p className="vp-error" role="alert">
          {error}
        </p>
      ) : (
        <>
          <div className="vp-time-slots">
            {slots.map((s) => (
              <button
                type="button"
                key={s.id}
                className={selected?.id === s.id ? "selected" : ""}
                aria-pressed={selected?.id === s.id}
                onClick={() => onSelect({ ...s, serviceId: service.id })}
              >
                {s.time}
                {selected?.id === s.id && <Check size={13} />}
              </button>
            ))}
          </div>
          {!slots.length && (
            <p className="vp-empty-slots">
              На эту дату нет подходящих окон
              . Выберите
              другую дату или специалиста.
            </p>
          )}
        </>
      )}
      {selected && (
        <p className="vp-selected-time">
          {dateLabel(selected.date)}, {selected.time}–{selected.endTime} ·{" "}
          {masters.find((m) => m.id === selected.masterId)?.name}
        </p>
      )}
    </div>
  );
}
export default function VisitPlanner({
  wishes,
  onWishesChange,
  ids,
  lookIds,
  initialBranch,
  onChange,
  onClear,
  onAppointments,
  notify,
}: {
  wishes: string;
  onWishesChange: (value: string) => void;
  ids: string[];
  lookIds: string[];
  initialBranch?: string;
  onChange: (ids: string[]) => void;
  onClear: () => void;
  onAppointments: () => void;
  notify: (m: string) => void;
}) {
  const { services, groups, looks, branches, masters } = useCatalog();
  const selected = ids
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is Service => !!s);
  const [step, setStep] = useState(0),
    [group, setGroup] = useState(() =>
      selected[0]?.audience === "nails"
        ? "nails"
        : groups.find((g) => g.serviceIds.includes(selected[0]?.id))?.id ||
          groups[0]?.id,
    ),
    [search, setSearch] = useState(""),
    [branchId, setBranchId] = useState(initialBranch || branches[0]?.id),
    [date, setDate] = useState(""),
    [dates, setDates] = useState<Record<string, string>>({}),
    [selections, setSelections] = useState<Record<string, Selection>>({}),
    [today, setToday] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [submitting, setSubmitting] = useState(false),
    [result, setResult] = useState<Appointment[] | null>(null),
    [refresh, setRefresh] = useState(0);
  const rootKey = useRef(crypto.randomUUID());
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    api<{ today: string }>("/health")
      .then((d) => setToday(d.today))
      .catch(() => {});
  }, []);
  const chosenGroup = groups.find((g) => g.id === group) || groups[0];
  const visible = services.filter(
    (s) =>
      (search ? true : chosenGroup?.serviceIds.includes(s.id)) &&
      s.name.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")),
  );
  const suggested = recommendations(selected, services);
  function reset() {
    setSelections({});
    rootKey.current = crypto.randomUUID();
    setError("");
  }
  function update(next: string[]) {
    onChange(next);
    reset();
  }
  function toggle(s: Service) {
    if (ids.includes(s.id)) update(ids.filter((id) => id !== s.id));
    else if (mergeVisitService(ids, s.id).length <= 6)
      update(mergeVisitService(ids, s.id));
    else setError("В один визит можно добавить до шести услуг.");
  }
  function next(n: number) {
    setStep(n);
    setError("");
    requestAnimationFrame(() => {
      stage.current
        ?.closest("dialog")
        ?.scrollTo({ top: 0, behavior: "instant" });
      stage.current?.focus({ preventScroll: true });
    });
  }
  function choose(id: string, slot: Selection) {
    setSelections((prev) => ({ ...prev, [id]: slot }));
    rootKey.current = crypto.randomUUID();
    setError("");
  }
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || !selected.every((s) => selections[s.id])) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await api<{ appointments: Appointment[] }>("/visits", {
        method: "POST",
        body: JSON.stringify({
          requestKey: rootKey.current,
          name,
          phone,
          note: [note, wishes ? "Дополнительно уточнить: " + wishes : ""]
            .filter(Boolean)
            .join("\n"),
          branchId,
          lookIds,
          items: selected.map((s) => ({
            serviceId: s.id,
            masterId: selections[s.id].masterId,
            date: selections[s.id].date,
            time: selections[s.id].time,
          })),
        }),
      });
      response.appointments.forEach(rememberAppointment);
      setResult(response.appointments);
      onClear();
      notify("Все процедуры сохранены. Карточки визита готовы.");
      next(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить визит.");
      if (
        e instanceof ApiError &&
        ["SLOT_TAKEN", "VISIT_OVERLAP", "IDEMPOTENCY_CONFLICT"].includes(e.code)
      ) {
        setSelections({});
        setStep(1);
        setRefresh((n) => n + 1);
        rootKey.current = crypto.randomUUID();
      }
    } finally {
      setSubmitting(false);
    }
  }
  if (result)
    return (
      <div className="vp-success" ref={stage} tabIndex={-1}>
        <CheckCheck size={36} />
        <span className="hn-kicker">ВАШ ВИЗИТ СОБРАН</span>
        <h2>Всё запланировано.</h2>
        <p>
          Процедур: {result.length}. Общая стоимость:{" "}
          <strong>{visitTotal(result)}</strong>.<br />
          Оплата в салоне. Деньги на сайте не списывались.
        </p>
        {result.map((a, i) => (
          <details className="vp-success-ticket" key={a.id} open={i === 0}>
            <summary>
              {dateLabel(a.date)} · {a.time} · {a.serviceName}
            </summary>
            <ReceiptTicket appointment={a} notify={notify} />
          </details>
        ))}
        <button className="hn-btn" onClick={onAppointments}>
          Мои записи <ArrowUpRight size={18} />
        </button>
      </div>
    );
  return (
    <div className="visit-planner">
      <div className="vp-heading" ref={stage} tabIndex={-1}>
        <span className="hn-kicker">ВАШ ЛИЧНЫЙ ПЛАН / АТЕЛЬЕ</span>
        <h2>
          {step === 0
            ? "Соберём ваш визит."
            : step === 1
              ? "Выберем удобное время."
              : "Осталось познакомиться."}
        </h2>
        <p>
          {step === 0
            ? "Сначала выберите процедуры. Можно добавить несколько услуг и спокойно сравнить варианты."
            : step === 1
              ? "Для каждой процедуры — своя дата и подходящий специалист. Можно прийти в один день или разделить процедуры на несколько дней."
              : "Проверьте детали и оставьте один контакт для всех процедур."}
        </p>
      </div>
      <nav className="vp-steps" aria-label="Шаги визита">
        {["Услуги", "Расписание", "Ваши данные"].map((text, i) => (
          <button
            key={text}
            type="button"
            aria-current={step === i ? "step" : undefined}
            disabled={i > step}
            onClick={() => next(i)}
          >
            <span>{step > i ? <Check size={14} /> : i + 1}</span>
            {text}
          </button>
        ))}
      </nav>
      {error && (
        <p className="vp-error" role="alert">
          {error}
        </p>
      )}
      {step === 0 && (
        <>
          <section className="vp-basket" aria-labelledby="vp-basket-heading">
            <div className="vp-basket-head">
              <h3 id="vp-basket-heading">
                Мой визит <span>{selected.length}</span>
              </h3>
              <strong>
                {selected.length ? visitTotal(selected) : "Выберите услуги"}
              </strong>
            </div>
            {selected.length ? (
              <div className="vp-basket-items">
                {selected.map((s) => (
                  <div key={s.id}>
                    <div>
                      <strong>{s.name}</strong>
                      <p>
                        {servicePrice(s)} · ориентир {s.durationMinutes} мин
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={"Убрать " + s.name}
                      onClick={() => toggle(s)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="vp-basket-empty">
                Добавьте то, что хочется сделать. Выбор мастера и времени будет
                после этого шага.
              </p>
            )}
            {lookIds.length > 0 && (
              <div className="vp-inspiration">
                {looks
                  .filter((l) => lookIds.includes(l.id))
                  .slice(0, 5)
                  .map((l) => (
                    <img
                      key={l.id}
                      src={imageUrl(l.image, 480)}
                      alt={l.title}
                      width={45}
                      height={55}
                    />
                  ))}
                <span>Вдохновение передадим мастеру</span>
              </div>
            )}
          </section>
          {suggested.length > 0 && (
            <section className="vp-suggestions">
              <h3>Можно совместить с визитом</h3>
              <p>Дополнительные услуги — только по вашему желанию.</p>
              <div>
                {suggested.map((s) => (
                  <button type="button" key={s.id} onClick={() => toggle(s)}>
                    <span>
                      <strong>{s.name}</strong>
                      <small>{servicePrice(s)}</small>
                    </span>
                    <Plus size={19} />
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="vp-catalog">
            <h3>
              {selected.length
                ? "Добавить ещё услугу"
                : "Что вы хотите сделать?"}
            </h3>
            <label className="vp-search">
              <Search size={18} />
              <input
                aria-label="Найти процедуру для визита"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Например, стрижка или борода"
              />
            </label>
            <div
              className="vp-groups"
              role="group"
              aria-label="Направления процедур"
            >
              {groups.map((g) => (
                <button
                  type="button"
                  key={g.id}
                  className={group === g.id && !search ? "selected" : ""}
                  aria-pressed={group === g.id && !search}
                  onClick={() => {
                    setGroup(g.id);
                    setSearch("");
                  }}
                >
                  {g.title}
                </button>
              ))}
            </div>
            <div className="vp-service-choices">
              {visible.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={ids.includes(s.id) ? "selected" : ""}
                  aria-pressed={ids.includes(s.id)}
                  onClick={() => toggle(s)}
                >
                  <span>
                    <strong>{s.name}</strong>
                    <small>
                      {servicePrice(s)} · {s.durationMinutes} мин
                    </small>
                  </span>
                  <span className="vp-add-icon">
                    {ids.includes(s.id) ? (
                      <Check size={18} />
                    ) : (
                      <Plus size={18} />
                    )}
                  </span>
                </button>
              ))}
              {!visible.length && (
                <p className="vp-empty-slots">
                  По этому названию ничего не найдено. Оставьте пожелание ниже —
                  администратор уточнит возможность.
                </p>
              )}
            </div>
          </section>
          <details className="vp-more-wishes">
            <summary>Есть особые пожелания?</summary>
            <label>
              Что ещё хотелось бы сделать?
              <textarea
                value={wishes}
                onChange={(e) => {
                  onWishesChange(e.target.value);
                  rootKey.current = crypto.randomUUID();
                }}
                rows={3}
                maxLength={500}
                placeholder="Например, хочу сохранить длину сверху"
              />
            </label>
            <p>
              Передадим пожелание администратору вместе с записью. Цена и время
              этой процедуры пока не включаются в визит: их нужно подтвердить
              отдельно.
            </p>
          </details>
        </>
      )}
      {step === 1 && (
        <>
          <div className="vp-date-branch">
            <label>
              Филиал
              <select
                aria-label="Филиал для всех процедур"
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setDate("");
                  reset();
                }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Начальная дата для процедур
              <input
                aria-label="Дата визита"
                type="date"
                min={today || undefined}
                max={
                  today
                    ? new Date(Date.parse(today + "T12:00Z") + 27 * 86400000)
                        .toISOString()
                        .slice(0, 10)
                    : undefined
                }
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setDates({});
                  reset();
                }}
              />
            </label>
          </div>
          <p className="vp-sequential-note"><Clock3 size={16} />Каждой процедуре можно назначить свою дату. Выбирайте в любом порядке: время не должно пересекаться, между процедурами оставляем 15 минут.</p>
          <div className="vp-schedule">
            {selected.map((s) => (
              <TimePicker key={s.id} service={s} date={dates[s.id] || date} branchId={branchId}
                selected={selections[s.id]} earlier={Object.values(selections).filter((item) => item.serviceId !== s.id)}
                onSelect={(slot) => choose(s.id, slot)}
                onInitialDate={(value) => setDates((prev) => ({ ...prev, [s.id]: value }))}
                onReset={() => { setSelections((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== s.id))); rootKey.current = crypto.randomUUID(); }}
                refresh={refresh} />
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <div className="vp-confirm-layout">
          <section className="vp-itinerary">
            <h3>Ваши процедуры</h3>
            <p>{branches.find((b) => b.id === branchId)?.name}</p>
            {selected.map((s) => (
              <article key={s.id}>
                <span>
                  {selections[s.id]?.time}
                  <small>до {selections[s.id]?.endTime}</small>
                </span>
                <div>
                  <h4>{s.name}</h4>
                  <p>{selections[s.id] ? dateLabel(selections[s.id].date) : ""}</p>
                  <p>
                    {
                      masters.find((m) => m.id === selections[s.id]?.masterId)
                        ?.name
                    }
                  </p>
                  <strong>{servicePrice(s)}</strong>
                </div>
              </article>
            ))}
            <div className="vp-itinerary-total">
              <span>Общая стоимость</span>
              <strong>{visitTotal(selected)}</strong>
            </div>
            <p className="vp-fine">
              Стоимость уточняемых процедур согласуется отдельно. Оплата в
              салоне.
            </p>
          </section>
          <form id="visit-contact-form" className="hn-form" onSubmit={submit}>
            <label>
              Как вас зовут
              <input
                name="name"
                autoComplete="given-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  rootKey.current = crypto.randomUUID();
                }}
                required
                minLength={2}
                maxLength={80}
              />
            </label>
            <label>
              Номер телефона
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  rootKey.current = crypto.randomUUID();
                }}
                required
                placeholder="+7 700 000 00 00"
                maxLength={24}
              />
            </label>
            <label>
              Пожелания
              <textarea
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  rootKey.current = crypto.randomUUID();
                }}
                maxLength={Math.max(100, 950 - wishes.length)}
                rows={3}
                placeholder="Что важно учесть мастеру?"
              />
            </label>
            {wishes && (
              <p className="vp-pending-wish">
                Передадим на уточнение: {wishes}
              </p>
            )}
            <label className="hn-consent">
              <input type="checkbox" required />
              Согласен на обработку имени, телефона и пожеланий для оформления
              визита.
            </label>
            <p className="vp-fine">
              Бронирование времени напрямую в расписание мастеров. Оплата после
              завершения визита.
            </p>
          </form>
        </div>
      )}
      <footer className="vp-footer">
        <div>
          {step > 0 ? (
            <button
              type="button"
              className="hn-text-btn"
              disabled={submitting}
              onClick={() => next(step - 1)}
            >
              <ArrowLeft size={17} />
              {step === 1 ? "Изменить услуги" : "Изменить время"}
            </button>
          ) : (
            <span>
              {selected.length
                ? `${selected.length} ${selected.length === 1 ? "услуга" : "услуги"}`
                : "Ваш выбор"}
            </span>
          )}
          <strong>
            {selected.length ? visitTotal(selected) : "Без предоплаты"}
          </strong>
        </div>
        {step === 0 ? (
          <button
            type="button"
            className="hn-btn"
            disabled={!selected.length}
            onClick={() => next(1)}
          >
            К выбору времени <ArrowRight size={18} />
          </button>
        ) : step === 1 ? (
          <button
            type="button"
            className="hn-btn"
            disabled={!selected.every((s) => selections[s.id])}
            onClick={() => next(2)}
          >
            Проверить визит <ArrowRight size={18} />
          </button>
        ) : (
          <button
            type="submit"
            form="visit-contact-form"
            className="hn-btn"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <LoaderCircle size={18} className="spin" />
                Сохраняем…
              </>
            ) : (
              <>
                Подтвердить визит <Check size={18} />
              </>
            )}
          </button>
        )}
      </footer>
    </div>
  );
}
