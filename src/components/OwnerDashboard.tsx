import { useEffect, useState, type SyntheticEvent } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Scissors,
  Settings2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api, dateLabel, type Appointment } from "../lib/booking";
import { defaultCatalog, imageUrl, type PublicCatalog } from "../lib/catalog";
import {
  audiences,
  money,
  servicePrice,
  type Look,
  type Review,
  type Service,
  type Shift,
} from "../data/studio";
import { compressPhoto } from "../lib/compress";
import Modal from "./Modal";
type Tab = "agenda" | "services" | "photos" | "reviews" | "team" | "settings";
type Media = { id: string; url: string; bytes: number; createdAt: string };
type Agenda = {
  bookings: Appointment[];
  blocks: {
    id: string;
    masterId: string;
    start: string;
    end: string;
    reason: string;
  }[];
};
const day = (date: string, n: number) =>
  new Date(Date.parse(date + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const tabs = [
  ["agenda", "Записи", CalendarDays],
  ["services", "Услуги и цены", Scissors],
  ["photos", "Фотографии", ImagePlus],
  ["reviews", "Отзывы", MessageSquare],
  ["team", "Команда и график", Users],
  ["settings", "Настройки", Settings2],
] as const;
export default function OwnerDashboard() {
  const [auth, setAuth] = useState<boolean | null>(null),
    [key, setKey] = useState(""),
    [tab, setTab] = useState<Tab>("agenda"),
    [content, setContent] = useState<PublicCatalog>(defaultCatalog),
    [date, setDate] = useState(""),
    [agenda, setAgenda] = useState<Agenda>({ bookings: [], blocks: [] }),
    [allServices, setAllServices] = useState<Service[]>([]),
    [allReviews, setAllReviews] = useState<Review[]>([]),
    [media, setMedia] = useState<Media[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState(""),
    [branch, setBranch] = useState("all"),
    [refresh, setRefresh] = useState(0),
    [editService, setEditService] = useState<Service | null>(null),
    [newService, setNewService] = useState(false),
    [quick, setQuick] = useState(false),
    [editLook, setEditLook] = useState<Look | null>(null),
    [newLook, setNewLook] = useState(false),
    [selectedMedia, setSelectedMedia] = useState(""),
    [compression, setCompression] = useState(""),
    [master, setMaster] = useState(""),
    [shifts, setShifts] = useState<Shift[]>([]),
    [block, setBlock] = useState(false),
    [confirm, setConfirm] = useState<{
      text: string;
      path: string;
      method?: string;
      body?: unknown;
    } | null>(null);
  const [notifications, setNotifications] = useState({
    configured: false,
    pending: 0,
  });
  const { services, masters, looks, branches, branding } = content;
  useEffect(() => {
    Promise.all([
      api<{ authenticated: boolean }>("/admin/session"),
      api<{ today: string }>("/health"),
    ])
      .then(([s, h]) => {
        setAuth(s.authenticated);
        setDate(h.today);
      })
      .catch((e) => {
        setAuth(false);
        setError(e.message);
      });
  }, []);
  useEffect(() => {
    if (auth)
      api<{ configured: boolean; pending: number }>("/admin/notifications")
        .then(setNotifications)
        .catch(() => {});
  }, [auth, refresh]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!auth) return;
    let active = true;
    Promise.all([
      api<PublicCatalog>("/content"),
      api<{ services: Service[] }>("/admin/services"),
      api<{ reviews: Review[] }>("/admin/reviews"),
      api<{ media: Media[] }>("/admin/media"),
    ])
      .then(([c, s, r, m]) => {
        if (active) {
          setContent(c);
          setAllServices(s.services);
          setAllReviews(r.reviews);
          setMedia(m.media);
          setMaster((v) => v || c.masters[0]?.id);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [auth, refresh]);
  useEffect(() => {
    if (!auth || !date) return;
    let active = true;
    api<Agenda>("/admin/agenda?date=" + date)
      .then((a) => {
        if (active) setAgenda(a);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [auth, date, refresh]);
  useEffect(() => {
    if (!auth || !master) return;
    let active = true;
    api<{ shifts: Shift[] }>("/admin/schedule/" + master)
      .then((d) => {
        if (active) setShifts(d.shifts);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [auth, master, refresh]);
  async function action(path: string, method = "POST", body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await api<any>(path, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      setNotice("Изменения сохранены");
      setRefresh((n) => n + 1);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function login(e: SyntheticEvent) {
    e.preventDefault();
    try {
      await action("/admin/session", "POST", { key });
      setKey("");
      setAuth(true);
    } catch {}
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const c = await compressPhoto(file);
      setCompression(
        `${(c.original / 1024 / 1024).toFixed(1)} МБ → ${Math.round(c.bytes / 1024)} КБ · WebP`,
      );
      const r = await api<Media>("/admin/media", {
        method: "POST",
        body: JSON.stringify({ data: c.data }),
      });
      setSelectedMedia(r.url);
      setMedia((v) => [r, ...v]);
      setNotice("Фото сжато и сохранено в медиатеке");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Фото не загрузилось");
    } finally {
      setBusy(false);
    }
  }
  async function submitService(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    const body = {
      ...d,
      price: Number(d.price),
      priceMax: Number(d.priceMax) || undefined,
      durationMinutes: Number(d.durationMinutes),
      from: false,
      priceOnRequest: d.priceOnRequest === "on",
      enabled: d.enabled === "on",
      masterIds: new FormData(e.currentTarget).getAll("masterIds"),
    };
    try {
      await action(
        editService ? "/admin/services/" + editService.id : "/admin/services",
        editService ? "PUT" : "POST",
        body,
      );
      setEditService(null);
      setNewService(false);
    } catch {}
  }
  async function submitLook(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    const service = services.find((s) => s.id === d.serviceId);
    try {
      await action("/admin/looks", "POST", {
        ...d,
        ...(editLook ? { id: editLook.id } : {}),
        image: selectedMedia || editLook?.image,
        audience: service?.audience || "women",
        kind: service?.audience === "nails" ? "nails" : "cut",
        tags: [],
        description: d.subtitle,
      });
      setEditLook(null);
      setNewLook(false);
      setSelectedMedia("");
    } catch {}
  }
  async function exportData() {
    try {
      const data = await api("/admin/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "v-akkurate-backup-" + date + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Резервная копия скачана. Храните её в закрытом месте.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const matching = allServices.filter((s) =>
    [s.name, s.detail].join(" ").toLowerCase().includes(filter.toLowerCase()),
  );
  const bookings = agenda.bookings.filter(
    (b) =>
      b.status !== "cancelled" && (branch === "all" || b.branchId === branch),
  );
  const pending = allReviews.filter((r) => r.status !== "published").length;
  if (auth === null)
    return (
      <div className="ad-loading">
        <LoaderCircle className="spin" size={20} />
        Открываем панель…
      </div>
    );
  if (!auth)
    return (
      <main className="ad-login">
        <a className="hn-logo" href="/">
          АТЕЛЬЕ
        </a>
        <div className="ad-login-card">
          <LockKeyhole size={24} />
          <span className="hn-kicker">ПРОСТРАНСТВО КОМАНДЫ</span>
          <h1>Всё под контролем.</h1>
          <p>Записи, цены и фотографии салона в одном месте.</p>
          <form className="hn-form" onSubmit={login}>
            <label htmlFor="owner-key">
              Ключ доступа
              <input
                id="owner-key"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button className="hn-btn" disabled={busy}>
              {busy ? "Проверяем…" : "Войти в панель"}
              <ArrowUpRight size={17} />
            </button>
          </form>
          {error && (
            <p className="ad-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <a href="/" className="hn-text-btn">
          Открыть сайт <ArrowUpRight size={15} />
        </a>
      </main>
    );
  return (
    <div className="ad-shell">
      <aside className="ad-sidebar">
        <a className="hn-logo" href="/" target="_blank">
          АТЕЛЬЕ
        </a>
        <span className="hn-kicker">ПАНЕЛЬ САЛОНА</span>
        <nav aria-label="Управление салоном">
          {tabs.map(([id, title, Icon]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                setFilter("");
                setError("");
              }}
            >
              <Icon size={17} />
              {title}
              {id === "reviews" && pending > 0 && <small>{pending}</small>}
            </button>
          ))}
        </nav>
        <div className="ad-sidebar-bottom">
          <a href="/" target="_blank">
            Открыть сайт <ArrowUpRight size={16} />
          </a>
          <button
            onClick={async () => {
              try {
                await action("/admin/session", "DELETE");
                setAuth(false);
              } catch {}
            }}
          >
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      </aside>
      <main className="ad-main">
        <header className="ad-top">
          <div>
            <span className="hn-kicker">
              АТЕЛЬЕ / РАБОЧЕЕ ПРОСТРАНСТВО
            </span>
            <h1>{tabs.find((t) => t[0] === tab)?.[1]}</h1>
          </div>
          <button
            className="ad-outline"
            onClick={() => setRefresh((n) => n + 1)}
            aria-label="Обновить данные"
          >
            <RefreshCw size={16} />
            <span>Обновить</span>
          </button>
        </header>
        <div className="ad-demo">
          Действующее расписание мастеров. Управление сменами, записями и блокировкой времени.
        </div>
        {error && (
          <div className="ad-error" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="Скрыть ошибку">
              <X size={15} />
            </button>
          </div>
        )}
        {notice && (
          <div className="ad-notice" role="status">
            <Check size={16} />
            {notice}
          </div>
        )}
        {tab === "agenda" && (
          <>
            <div className="ad-stats">
              <div>
                <span>Записей на день</span>
                <strong>{bookings.length.toString().padStart(2, "0")}</strong>
              </div>
              <div>
                <span>Услуги по прайсу</span>
                <strong>
                  {money(bookings.reduce((sum, b) => sum + b.price, 0))}
                </strong>
                <small>Не подтверждённая выручка</small>
              </div>
              <div>
                <span>Ждут модерации</span>
                <strong>{pending.toString().padStart(2, "0")}</strong>
              </div>
            </div>
            <div className="ad-toolbar">
              <div className="ad-date">
                <button
                  aria-label="Предыдущий день"
                  onClick={() => setDate(day(date, -1))}
                >
                  <ChevronLeft size={18} />
                </button>
                <input
                  type="date"
                  aria-label="Дата записей"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <button
                  aria-label="Следующий день"
                  onClick={() => setDate(day(date, 1))}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <select
                aria-label="Филиал"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              >
                <option value="all">Все филиалы</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button className="hn-btn" onClick={() => setQuick(true)}>
                <Plus size={16} />
                Новая запись
              </button>
              <button className="ad-outline" onClick={() => setBlock(true)}>
                Закрыть время
              </button>
            </div>
            <div className="ad-agenda">
              {bookings.length ? (
                bookings.map((b) => (
                  <article key={b.id} className="ad-booking">
                    <div className="ad-booking-time">
                      {b.time}
                      <small>до {b.endTime}</small>
                    </div>
                    <div>
                      <h3>{b.name}</h3>
                      <p>{b.serviceName}</p>
                      <span>
                        {b.masterName} ·{" "}
                        {branches.find((br) => br.id === b.branchId)?.name}
                      </span>
                    </div>
                    <div className="ad-booking-meta">
                      <strong>{servicePrice(b as any)}</strong>
                      <a href={`tel:${b.phone}`}>{b.phone}</a>
                    </div>
                    <div className="ad-booking-actions">
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={`https://wa.me/${b.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Здравствуйте, ${b.name}! Напоминаем о записи ${dateLabel(b.date)} в ${b.time}. Ателье, ${branches.find((br) => br.id === b.branchId)?.name}.`)}`}
                      >
                        Напомнить <ArrowUpRight size={13} />
                      </a>
                      <button
                        onClick={() =>
                          setConfirm({
                            text:
                              "Отменить запись " +
                              b.name +
                              " на " +
                              b.time +
                              "?",
                            path: "/admin/bookings/" + b.id + "/cancel",
                            body: {},
                          })
                        }
                      >
                        Отменить
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="ad-empty">
                  <CalendarDays size={29} strokeWidth={1} />
                  <h3>День свободен</h3>
                  <p>
                    Записи с сайта появятся здесь автоматически.
                    <br />
                    Запись по телефону можно добавить вручную.
                  </p>
                  <button
                    className="hn-text-btn"
                    onClick={() => setQuick(true)}
                  >
                    Добавить запись <Plus size={15} />
                  </button>
                </div>
              )}
            </div>
            {agenda.blocks.length > 0 && (
              <div className="ad-card">
                <h3>Закрытое время</h3>
                {agenda.blocks.map((b) => (
                  <div className="ad-block" key={b.id}>
                    <span>
                      {masters.find((m) => m.id === b.masterId)?.name} ·{" "}
                      {b.start}–{b.end} · {b.reason}
                    </span>
                    <button
                      className="ad-outline"
                      onClick={() =>
                        setConfirm({
                          text: "Снова открыть это время?",
                          path: "/admin/blocks/" + b.id,
                          method: "DELETE",
                        })
                      }
                    >
                      Открыть
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="ad-help">
              Записи сохраняются сразу. WhatsApp открывает подготовленное
              сообщение — отправку подтверждает администратор.
            </p>
          </>
        )}
        {tab === "services" && (
          <>
            <div className="ad-toolbar">
              <input
                aria-label="Поиск услуги"
                placeholder="Найти услугу…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <button className="hn-btn" onClick={() => setNewService(true)}>
                <Plus size={16} />
                Добавить услугу
              </button>
            </div>
            <div className="ad-service-list">
              {matching.map((s) => (
                <article key={s.id}>
                  <div>
                    <span className="hn-kicker">
                      {audiences.find((a) => a.id === s.audience)?.label}
                    </span>
                    <h3>{s.name}</h3>
                    <p>
                      {s.durationMinutes} мин ·{" "}
                      {s.enabled === false
                        ? "Скрыта с сайта"
                        : "Видна на сайте"}
                    </p>
                  </div>
                  <strong>{servicePrice(s)}</strong>
                  <button
                    className="ad-outline"
                    onClick={() => setEditService(s)}
                  >
                    Изменить
                  </button>
                </article>
              ))}
            </div>
            <p className="ad-help">
              Сохранённые изменения отображаются на сайте после обновления
              страницы. Стоимость уже оформленного визита сохраняется.
            </p>
          </>
        )}
        {tab === "photos" && (
          <>
            <div className="ad-card ad-upload">
              <div>
                <span className="hn-kicker">МЕДИАТЕКА / БЕРЕЖНО К ЛИМИТАМ</span>
                <h2>
                  Ваши работы.
                  <br />
                  <em>В лучшем свете.</em>
                </h2>
                <p>
                  Фото сжимается на вашем устройстве до WebP, максимум 160 КБ.
                  Исходник с метаданными не загружается.
                </p>
                <label className="hn-btn">
                  <ImagePlus size={17} />
                  {busy ? "Обрабатываем…" : "Загрузить фото"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    disabled={busy}
                    onChange={(e) => upload(e.target.files?.[0])}
                  />
                </label>
                {compression && <p className="ad-compression">{compression}</p>}
              </div>
              <div className="ad-storage">
                <strong>
                  {(
                    media.reduce((s, m) => s + m.bytes, 0) /
                    1024 /
                    1024
                  ).toFixed(1)}
                  <small> / 80 МБ</small>
                </strong>
                <span>Фото в медиатеке: {media.length}</span>
                <progress
                  max={80 * 1024 * 1024}
                  value={media.reduce((s, m) => s + m.bytes, 0)}
                />
                <p>
                  Встроенный предел помогает оставить запас для записей и
                  резервных копий.
                </p>
              </div>
            </div>
            {media.length > 0 && (
              <div className="ad-media-grid">
                {media.map((m) => (
                  <article
                    key={m.id}
                    className={selectedMedia === m.url ? "selected" : ""}
                  >
                    <button
                      onClick={() => {
                        setSelectedMedia(m.url);
                        setNewLook(true);
                      }}
                      aria-label="Добавить фото в галерею"
                    >
                      <img src={m.url} alt="Загруженная фотография" />
                      <span>{Math.round(m.bytes / 1024)} КБ</span>
                    </button>
                    <button
                      className="ad-trash"
                      aria-label="Удалить фото из медиатеки"
                      onClick={() =>
                        setConfirm({
                          text: "Удалить фотографию из медиатеки? Используемое на сайте фото удалить нельзя.",
                          path: "/admin/media/" + m.id,
                          method: "DELETE",
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </article>
                ))}
              </div>
            )}
            <div className="ad-toolbar">
              <h2>Галерея сайта</h2>
              <button
                className="ad-outline"
                onClick={() => {
                  setSelectedMedia("");
                  setNewLook(true);
                }}
              >
                <Plus size={16} />
                Добавить работу
              </button>
            </div>
            <div className="ad-gallery-grid">
              {looks.map((l) => (
                <article key={l.id}>
                  <img src={imageUrl(l.image, 480)} alt={l.title} />
                  <div>
                    <span className="hn-kicker">
                      {l.custom ? "РАБОТА САЛОНА" : "ИЛЛЮСТРАЦИЯ"}
                    </span>
                    <h3>{l.title}</h3>
                    <p>{services.find((s) => s.id === l.serviceId)?.name}</p>
                    <div>
                      <button
                        className="ad-outline"
                        onClick={() => {
                          setEditLook(l);
                          setSelectedMedia("");
                        }}
                      >
                        Изменить
                      </button>
                      <button
                        className="ad-outline"
                        aria-label={"Убрать " + l.title}
                        onClick={() =>
                          setConfirm({
                            text: "Убрать образ из галереи?",
                            path: "/admin/looks/" + l.id,
                            method: "DELETE",
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {tab === "reviews" && (
          <>
            <div className="ad-card">
              <h2>Сначала проверка, затем публикация</h2>
              <p>
                Гости отправляют отзывы с сайта. Непроверенные отзывы не
                становятся «подтверждёнными» автоматически.
              </p>
            </div>
            <div className="ad-review-list">
              {allReviews.length ? (
                allReviews.map((r) => (
                  <article key={r.id}>
                    <div>
                      <h3>{r.author}</h3>
                      <span>
                        {r.rating} из 5 · {r.branch} ·{" "}
                        {r.status === "published"
                          ? "Опубликован"
                          : "На модерации"}
                      </span>
                    </div>
                    <p>{r.text}</p>
                    <div>
                      <button
                        className="ad-outline"
                        disabled={busy}
                        onClick={() =>
                          action("/admin/reviews/" + r.id, "PUT", {
                            status:
                              r.status === "published"
                                ? "pending"
                                : "published",
                          }).catch(() => {})
                        }
                      >
                        {r.status === "published"
                          ? "Снять с публикации"
                          : "Опубликовать"}
                      </button>
                      <button
                        className="ad-outline"
                        onClick={() =>
                          setConfirm({
                            text: "Удалить этот отзыв?",
                            path: "/admin/reviews/" + r.id,
                            method: "DELETE",
                          })
                        }
                      >
                        <Trash2 size={14} />
                        Удалить
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="ad-empty">
                  <MessageSquare size={30} strokeWidth={1} />
                  <h3>Пока нет отзывов с сайта</h3>
                  <p>Отправленные гостями отзывы появятся в этом разделе.</p>
                </div>
              )}
            </div>
          </>
        )}
        {tab === "team" && (
          <>
            <div className="ad-toolbar">
              <select
                aria-label="Мастер"
                value={master}
                onChange={(e) => setMaster(e.target.value)}
              >
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            {masters.find((m) => m.id === master) && (
              <form
                key={master + refresh}
                className="ad-card hn-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  try {
                    await action("/admin/masters/" + master, "PUT", {
                      name: d.get("name"),
                      role: d.get("role"),
                      branchIds: d.getAll("branchIds"),
                      serviceIds: d.getAll("serviceIds"),
                    });
                  } catch {}
                }}
              >
                <h2>Карточка мастера</h2>
                <div className="ad-form-grid">
                  <label>
                    Имя
                    <input
                      name="name"
                      defaultValue={masters.find((m) => m.id === master)?.name}
                      required
                    />
                  </label>
                  <label>
                    Специализация
                    <input
                      name="role"
                      defaultValue={masters.find((m) => m.id === master)?.role}
                      required
                    />
                  </label>
                </div>
                <fieldset>
                  <legend>Филиалы</legend>
                  {branches.map((b) => (
                    <label className="ad-check" key={b.id}>
                      <input
                        type="checkbox"
                        name="branchIds"
                        value={b.id}
                        defaultChecked={masters
                          .find((m) => m.id === master)
                          ?.branchIds?.includes(b.id)}
                      />
                      {b.name}
                    </label>
                  ))}
                </fieldset>
                <fieldset className="ad-service-checks">
                  <legend>Услуги мастера</legend>
                  {services.map((s) => (
                    <label className="ad-check" key={s.id}>
                      <input
                        type="checkbox"
                        name="serviceIds"
                        value={s.id}
                        defaultChecked={masters
                          .find((m) => m.id === master)
                          ?.serviceIds.includes(s.id)}
                      />
                      {s.name}
                    </label>
                  ))}
                </fieldset>
                <button className="hn-btn" disabled={busy}>
                  Сохранить мастера <Check size={16} />
                </button>
              </form>
            )}
            <form
              className="ad-card hn-form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await action("/admin/schedule/" + master, "PUT", { shifts });
                } catch {}
              }}
            >
              <h2>Еженедельный график</h2>
              <p>
                Смена и перерыв влияют на доступное время. Уже созданные записи
                не удаляются.
              </p>
              <div className="ad-shifts">
                {shifts.map((s, i) => (
                  <div key={s.weekday}>
                    <label className="ad-check">
                      <input
                        aria-label={
                          "Работает " +
                          ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][s.weekday]
                        }
                        type="checkbox"
                        checked={s.enabled}
                        onChange={(e) =>
                          setShifts((v) =>
                            v.map((x, j) =>
                              j === i ? { ...x, enabled: e.target.checked } : x,
                            ),
                          )
                        }
                      />
                      {["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][s.weekday]}
                    </label>
                    {(["start", "end", "breakStart", "breakEnd"] as const).map(
                      (k, j) => (
                        <label key={k}>
                          {["Начало", "Конец", "Перерыв с", "До"][j]}
                          <input
                            type="time"
                            value={s[k]}
                            onChange={(e) =>
                              setShifts((v) =>
                                v.map((x, n) =>
                                  n === i ? { ...x, [k]: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </label>
                      ),
                    )}
                  </div>
                ))}
              </div>
              <button className="hn-btn" disabled={busy}>
                Сохранить график <Check size={16} />
              </button>
            </form>
          </>
        )}
        {tab === "settings" && (
          <>
            <form
              key={refresh}
              className="ad-card hn-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const entries = Array.from(
                  new FormData(e.currentTarget).entries(),
                );
                try {
                  for (const [key, value] of entries)
                    await action("/admin/branding", "POST", { key, value });
                } catch {}
              }}
            >
              <h2>Название и контакты</h2>
              <div className="ad-form-grid">
                {[
                  ["name", "Название салона", "Ателье"],
                  ["tagline", "Подпись", "Точность, которая вам идёт"],
                  ["instagramUrl", "Instagram", ""],
                  ["phone_satpaeva", "Телефон салона", "70000000000"],
                ].map(([key, label, fallback]) => (
                  <label key={key}>
                    {label}
                    <input
                      name={key}
                      defaultValue={String(branding[key] || fallback)}
                    />
                  </label>
                ))}
              </div>
              <button className="hn-btn" disabled={busy}>
                Сохранить настройки <Check size={16} />
              </button>
            </form>
            <div className="ad-card">
              <h2>Главное фото и логотип</h2>
              <p>
                Сначала загрузите изображение в разделе «Фотографии», затем
                выберите его здесь.
              </p>
              {[
                ["hero_image", "Главное фото"],
                ["logo_url", "Логотип"],
              ].map(([key, label]) => (
                <form
                  className="ad-brand-image"
                  key={key + refresh}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await action("/admin/branding", "POST", {
                        key,
                        value: new FormData(e.currentTarget).get("value"),
                      });
                    } catch {}
                  }}
                >
                  <label>
                    {label}
                    <select
                      name="value"
                      defaultValue={String(branding[key] || "")}
                    >
                      <option value="">Исходное оформление</option>
                      {media.map((m, i) => (
                        <option key={m.id} value={m.url}>
                          Фото {media.length - i} · {Math.round(m.bytes / 1024)}{" "}
                          КБ
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="ad-outline" disabled={busy}>
                    Применить
                  </button>
                </form>
              ))}
            </div>
            <div className="ad-card">
              <h2>Резервная копия</h2>
              <p>
                Скачайте записи, настройки, графики, отзывы и ссылки на
                фотографии. В копии есть данные клиентов — храните её в закрытой
                папке.
              </p>
              <button className="ad-outline" onClick={exportData}>
                <Download size={16} />
                Скачать копию
              </button>
            </div>
            <div className="ad-card">
              <h2>Уведомления</h2>
              <p>
                {notifications.configured
                  ? `Telegram подключён. Сообщений в очереди: ${notifications.pending}.`
                  : "Telegram пока не подключён. Новые записи доступны в разделе «Записи»."}
              </p>
              {notifications.configured && (
                <button
                  className="ad-outline"
                  disabled={busy}
                  onClick={() =>
                    action("/admin/notifications/retry", "POST", {}).catch(
                      () => {},
                    )
                  }
                >
                  Повторить отправку
                </button>
              )}
              <h2 style={{ marginTop: 24 }}>Подключение перед запуском</h2>
              <p>
                Сейчас доступны запись без предоплаты и оплата в салоне. Для
                автоматических уведомлений разработчик подключает Telegram.
                Онлайн-оплата потребует договора салона с платёжным провайдером.
              </p>
              <p>
                Бесплатное размещение предусматривает ограничения нагрузки и
                хранения. Текущее использование видно в кабинете Cloudflare.
              </p>
            </div>
          </>
        )}
      </main>
      {(editService || newService) && (
        <Modal
          title={editService ? "Изменить услугу" : "Добавить услугу"}
          onClose={() => {
            setEditService(null);
            setNewService(false);
          }}
        >
          <div className="hn-dialog-content">
            <h2>{editService ? "Услуга и стоимость" : "Новая услуга"}</h2>
            <form className="hn-form" onSubmit={submitService}>
              <label>
                Название
                <input
                  name="name"
                  required
                  minLength={2}
                  defaultValue={editService?.name}
                />
              </label>
              <label>
                Описание
                <textarea
                  name="detail"
                  defaultValue={editService?.detail}
                  rows={3}
                />
              </label>
              <div className="ad-form-grid">
                <label>
                  Цена, ₸
                  <input
                    name="price"
                    type="number"
                    min="0"
                    required
                    defaultValue={editService?.price || 0}
                  />
                </label>
                <label>
                  Верхняя цена, ₸
                  <input
                    name="priceMax"
                    type="number"
                    min="0"
                    defaultValue={editService?.priceMax}
                  />
                </label>
                <label>
                  Длительность, мин
                  <input
                    name="durationMinutes"
                    type="number"
                    min="15"
                    max="600"
                    step="5"
                    required
                    defaultValue={editService?.durationMinutes || 60}
                  />
                </label>
                <label>
                  Раздел
                  <select
                    name="audience"
                    defaultValue={editService?.audience || "women"}
                  >
                    {audiences
                      .filter((a) => a.id !== "all")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <label className="ad-check">
                <input
                  type="checkbox"
                  name="priceOnRequest"
                  defaultChecked={editService?.priceOnRequest}
                />
                Цена по согласованию
              </label>
              <label className="ad-check">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={editService?.enabled !== false}
                />
                Показывать на сайте
              </label>
              {!editService && (
                <fieldset>
                  <legend>Кто выполняет</legend>
                  {masters.map((m) => (
                    <label className="ad-check" key={m.id}>
                      <input type="checkbox" name="masterIds" value={m.id} />
                      {m.name}
                    </label>
                  ))}
                </fieldset>
              )}
              <button className="hn-btn" disabled={busy}>
                Сохранить <Check size={16} />
              </button>
            </form>
          </div>
        </Modal>
      )}
      {(newLook || editLook) && (
        <Modal
          title="Работа в галерее"
          onClose={() => {
            setNewLook(false);
            setEditLook(null);
          }}
        >
          <div className="hn-dialog-content">
            <h2>{editLook ? "Изменить образ" : "Добавить работу"}</h2>
            <form className="hn-form" onSubmit={submitLook}>
              <label>
                Фотография
                <select
                  value={selectedMedia || editLook?.image || ""}
                  onChange={(e) => setSelectedMedia(e.target.value)}
                  required
                >
                  <option value="">Выберите загруженное фото</option>
                  {editLook && !editLook.image.startsWith("/api/media/") && (
                    <option value={editLook.image}>Исходная иллюстрация</option>
                  )}
                  {media.map((m, i) => (
                    <option key={m.id} value={m.url}>
                      Фото {media.length - i} · {Math.round(m.bytes / 1024)} КБ
                    </option>
                  ))}
                </select>
              </label>
              {(selectedMedia || editLook?.image) && (
                <img
                  className="ad-photo-preview"
                  src={imageUrl(selectedMedia || editLook!.image, 480)}
                  alt="Предпросмотр"
                />
              )}
              <label>
                Название
                <input name="title" required defaultValue={editLook?.title} />
              </label>
              <label>
                Подпись
                <input name="subtitle" defaultValue={editLook?.subtitle} />
              </label>
              <label>
                Услуга
                <select name="serviceId" defaultValue={editLook?.serviceId}>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Мастер
                <select name="masterId" defaultValue={editLook?.masterId}>
                  {masters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="hn-btn" disabled={busy}>
                Сохранить работу <Check size={16} />
              </button>
            </form>
          </div>
        </Modal>
      )}
      {quick && (
        <Modal title="Новая запись" onClose={() => setQuick(false)}>
          <div className="hn-dialog-content">
            <h2>Запись по звонку</h2>
            <p>Та же проверка свободного времени, что и при записи на сайте.</p>
            <form
              className="hn-form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await action(
                    "/admin/bookings/quick",
                    "POST",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                  setQuick(false);
                } catch {}
              }}
            >
              <label>
                Имя
                <input name="name" required minLength={2} />
              </label>
              <label>
                Телефон
                <input
                  name="phone"
                  type="tel"
                  required
                  placeholder="+7 700 000 00 00"
                />
              </label>
              <label>
                Услуга
                <select name="serviceId">
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Мастер
                <select name="masterId">
                  {masters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Филиал
                <select name="branchId">
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ad-form-grid">
                <label>
                  Дата
                  <input type="date" name="date" required defaultValue={date} />
                </label>
                <label>
                  Время
                  <input
                    type="time"
                    name="time"
                    step="900"
                    required
                    defaultValue="10:00"
                  />
                </label>
              </div>
              <label>
                Пожелания
                <textarea name="note" rows={2} />
              </label>
              <button className="hn-btn" disabled={busy}>
                Сохранить запись <Check size={16} />
              </button>
            </form>
          </div>
        </Modal>
      )}
      {block && (
        <Modal title="Закрыть время" onClose={() => setBlock(false)}>
          <div className="hn-dialog-content">
            <h2>Перерыв или личное время</h2>
            <form
              className="hn-form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await action(
                    "/admin/blocks",
                    "POST",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                  setBlock(false);
                } catch {}
              }}
            >
              <label>
                Мастер
                <select name="masterId">
                  {masters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Дата
                <input name="date" type="date" required defaultValue={date} />
              </label>
              <div className="ad-form-grid">
                <label>
                  Начало
                  <input
                    name="start"
                    type="time"
                    required
                    defaultValue="13:00"
                  />
                </label>
                <label>
                  Конец
                  <input name="end" type="time" required defaultValue="14:00" />
                </label>
              </div>
              <label>
                Причина
                <input name="reason" maxLength={160} />
              </label>
              <button className="hn-btn" disabled={busy}>
                Закрыть время <Check size={16} />
              </button>
            </form>
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal title="Подтвердить действие" onClose={() => setConfirm(null)}>
          <div className="hn-dialog-content">
            <h2>Подтвердите действие</h2>
            <p>{confirm.text}</p>
            <div className="ad-toolbar">
              <button
                className="hn-btn"
                disabled={busy}
                onClick={async () => {
                  try {
                    await action(
                      confirm.path,
                      confirm.method || "POST",
                      confirm.body,
                    );
                    setConfirm(null);
                  } catch {}
                }}
              >
                Подтвердить
              </button>
              <button className="ad-outline" onClick={() => setConfirm(null)}>
                Оставить как есть
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
