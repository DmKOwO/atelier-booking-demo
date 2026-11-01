import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDown as ArrowDownIcon,
  CalendarDays,
  Check,
  ChevronDown,
  Heart,
  ShoppingBag,
  MapPin,
  Menu,
  Moon,
  Phone,
  Plus,
  Search,
  Star,
  Sun,
  X,
} from "lucide-react";
import { studio, servicePrice, type Look, type Review } from "../data/studio";
import {
  CatalogContext,
  defaultCatalog,
  imageUrl,
  type PublicCatalog,
} from "../lib/catalog";
import Modal from "./Modal";
import { type BookingOptions } from "./Booking";
import Appointments from "./Appointments";
import VisitPlanner from "./VisitPlanner";
import LookDetails from "./LookDetails";
import Photo from "./Photo";
import { mergeVisitService } from "../lib/visit";

type Panel =
  | { type: "visit"; options: BookingOptions }
  | { type: "look"; id: string }
  | { type: "appointments"; token?: string }
  | { type: "privacy" }
  | { type: "saved" }
  | { type: "review" }
  | null;
export default function BeautySalon() {
  const [content, setContent] = useState<PublicCatalog>(defaultCatalog),
    [panel, setPanel] = useState<Panel>(null),
    [saved, setSaved] = useState<string[]>([]),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false),
    [category, setCategory] = useState("all"),
    [theme, setTheme] = useState<"light" | "dark">(() => {
      if (typeof document !== "undefined") {
        const current = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
        if (current === "dark" || current === "light") return current;
        try {
          const saved = localStorage.getItem("theme") as "light" | "dark" | null;
          if (saved === "dark" || saved === "light") return saved;
        } catch {}
      }
      return "light";
    }),
    [query, setQuery] = useState(""),
    [activeGroup, setActiveGroup] = useState("hair"),
    [reviews, setReviews] = useState<Review[]>([]),
    [sending, setSending] = useState(false);
  const [visitIds, setVisitIds] = useState<string[]>([]),
    [visitLookIds, setVisitLookIds] = useState<string[]>([]),
    [draftLoaded, setDraftLoaded] = useState(false),
    [visitWishes, setVisitWishes] = useState("");
  const { services, looks, branches, branding, groups } = content;

  useEffect(() => {
    try {
      const current = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
      let target: "light" | "dark" = theme;
      if (current === "dark" || current === "light") {
        target = current;
      } else {
        const saved = localStorage.getItem("theme") as "light" | "dark" | null;
        if (saved === "dark" || saved === "light") {
          target = saved;
        } else {
          const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
          target = prefersDark ? "dark" : "light";
        }
      }
      setTheme(target);
      document.documentElement.setAttribute("data-theme", target);
      document.documentElement.style.colorScheme = target;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", target === "dark" ? "#181016" : "#fdf7f9");
    } catch (e) {}
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("theme", next);
      document.documentElement.setAttribute("data-theme", next);
      document.documentElement.style.colorScheme = next;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", next === "dark" ? "#181016" : "#fdf7f9");
    } catch (e) {}
  };
  useEffect(() => {
    fetch("/api/content")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setContent({ ...defaultCatalog, ...d });
        setReviews(d.reviews || []);
      })
      .catch(() => {});
    try {
      setSaved(
        JSON.parse(localStorage.getItem("deesse-saved") || "[]").filter(
          (id: unknown) => typeof id === "string",
        ),
      );
    } catch {}
    try {
      const draft = JSON.parse(
        localStorage.getItem("deesse-visit-v1") || "{}",
      );
      setVisitWishes(
        typeof draft.wishes === "string" ? draft.wishes.slice(0, 500) : "",
      );
      setVisitIds(
        Array.isArray(draft.ids)
          ? draft.ids.filter((id: unknown) => typeof id === "string")
          : [],
      );
      setVisitLookIds(
        Array.isArray(draft.lookIds)
          ? draft.lookIds.filter((id: unknown) => typeof id === "string")
          : [],
      );
    } catch {}
    setDraftLoaded(true);
    const read = () => {
      const h = location.hash;
      if (h === "#book") setPanel({ type: "visit", options: {} });
      const token = h.match(/^#appointment\/([\w-]{43})$/)?.[1];
      if (token) setPanel({ type: "appointments", token });
      const id = h.match(/^#look\/([\w-]+)$/)?.[1];
      if (id) setPanel({ type: "look", id });
    };
    read();
    addEventListener("hashchange", read);
    return () => removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (draftLoaded)
      try {
        localStorage.setItem(
          "deesse-visit-v1",
          JSON.stringify({
            ids: visitIds,
            lookIds: visitLookIds,
            wishes: visitWishes,
          }),
        );
      } catch {}
  }, [draftLoaded, visitIds, visitLookIds, visitWishes]);
  function addToVisit(id: string, lookId?: string) {
    const next = visitIds.includes(id)
      ? visitIds
      : mergeVisitService(visitIds, id);
    if (next.length > 6) {
      setToast("В один визит можно добавить до шести услуг.");
      return;
    }
    setVisitIds(next);
    if (lookId) setVisitLookIds((prev) => [...new Set([...prev, lookId])]);
    setToast("Услуга добавлена в мой визит. Можно продолжить выбор.");
  }
  function save(id: string) {
    const n = saved.includes(id)
      ? saved.filter((x) => x !== id)
      : [...saved, id];
    setSaved(n);
    try {
      localStorage.setItem("deesse-saved", JSON.stringify(n));
    } catch {}
    setToast(
      n.includes(id) ? "Образ сохранён в подборку" : "Образ убран из подборки",
    );
  }
  function close() {
    setPanel(null);
    if (/^#(look\/|appointment\/|book)/.test(location.hash))
      history.replaceState(null, "", location.pathname);
  }
  function book(options: BookingOptions = {}) {
    setMenu(false);
    if (options.serviceId) addToVisit(options.serviceId);
    if (options.lookIds)
      setVisitLookIds((prev) => [
        ...new Set([...prev, ...(options.lookIds || [])]),
      ]);
    setPanel({ type: "visit", options });
  }
  const activeLook =
    panel?.type === "look" ? looks.find((l) => l.id === panel.id) : undefined;
  const filtered = looks.filter(
    (look) => category === "all" || look.audience === category,
  );
  const group = groups.find((g) => g.id === activeGroup) || groups[0];
  const groupServices = services.filter(
    (s) =>
      (query ? true : (group.id === "hair" ? ["women", "men"].includes(s.audience) : s.audience === group.audience)) &&
      `${s.name} ${s.detail}`.toLowerCase().includes(query.toLowerCase()),
  );
  const brand = (key: string, fallback: string) =>
    typeof branding[key] === "string" && branding[key]
      ? String(branding[key])
      : fallback;
  const card = (l: Look) => (
    <article className="hn-look" key={l.id}>
      <div className="hn-look-image">
        <button
          className="hn-image-button"
          onClick={() => setPanel({ type: "look", id: l.id })}
          aria-label={`Посмотреть: ${l.title}`}
        >
          <Photo
            name={l.image}
            style={{ objectPosition: l.position }}
            alt={l.title}
            loading="lazy"
            width="600"
            height="750"
          />
          <span>
            Подробнее <ArrowUpRight size={18} />
          </span>
        </button>
        <button
          className="hn-save"
          aria-label={`${saved.includes(l.id) ? "Убрать" : "Сохранить"}: ${l.title}`}
          aria-pressed={saved.includes(l.id)}
          onClick={() => save(l.id)}
        >
          <Heart
            size={19}
            fill={saved.includes(l.id) ? "currentColor" : "none"}
          />
        </button>
      </div>
      <div className="hn-look-caption">
        <div>
          <h3>
            <button onClick={() => setPanel({ type: "look", id: l.id })}>
              {l.title}
            </button>
          </h3>
          <p>{l.subtitle}</p>
        </div>
        <ArrowUpRight size={20} />
      </div>
      <span className="hn-look-price">
        {services.find((s) => s.id === l.serviceId)
          ? servicePrice(services.find((s) => s.id === l.serviceId)!)
          : "Уточните стоимость"}
      </span>
    </article>
  );
  async function submitReview(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, rating: Number(data.rating) }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setToast("Спасибо. Отзыв отправлен на модерацию.");
      close();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Не удалось отправить отзыв");
    } finally {
      setSending(false);
    }
  }
  const addService = (id: string) => addToVisit(id);
  const heroService = services.find((service) => service.id === "men-cut");

  const [ideaIds, setIdeaIds] = useState<string[]>([]);
  const [ideaNote, setIdeaNote] = useState("");
  const selectedIdeas = looks.filter((l) => ideaIds.includes(l.id));
  function addBundle(ids: string[], note = "", lookIds: string[] = []) {
    const valid = ids.filter((id) => services.some((s) => s.id === id));
    setVisitIds((prev) => valid.reduce((next, id) => mergeVisitService(next, id), prev).slice(0, 6));
    setVisitLookIds((prev) => [...new Set([...prev, ...lookIds])]);
    if (note) setVisitWishes((prev) => [...new Set([prev, note].filter(Boolean))].join("\n").slice(0, 500));
    setToast("Добавлено в мой визит. Можно продолжить выбор.");
  }
  const renderService = (s: typeof services[number], i: number) => (
    <article className="d2-service" key={s.id}>
      <span className="d2-index">{String(i + 1).padStart(2, "0")}</span>
      <div>
        <h3>{s.name}</h3>
        <p>{s.detail}</p>
      </div>
      <strong>{servicePrice(s)}</strong>
      <button
        className={visitIds.includes(s.id) ? "d2-add selected" : "d2-add"}
        aria-label={`${visitIds.includes(s.id) ? "Убрать" : "Добавить"}: ${s.name}`}
        aria-pressed={visitIds.includes(s.id)}
        onClick={() =>
          visitIds.includes(s.id)
            ? setVisitIds((prev) => prev.filter((id) => id !== s.id))
            : addToVisit(s.id)
        }
      >
        {visitIds.includes(s.id) ? <Check size={20} /> : <Plus size={20} />}
      </button>
    </article>
  );

  const filters = (
    <div className="d2-filters" role="group" aria-label="Категория образов">
      {[["all","Все"],["women","Волосы"],["nails","Ногти"],["care","Брови"]].map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={category === id ? "active" : ""}
          aria-pressed={category === id}
          onClick={() => setCategory(id)}
        >
          {label}
          <small>
            {
              looks.filter((l) =>
                id === "all"
                  ? true
                  : true
                  ? l.audience === id
                  : id === "beard"
                  ? l.serviceId === "men-beard"
                  : l.serviceId !== "men-beard"
              ).length
            }
          </small>
        </button>
      ))}
    </div>
  );

  const siteHeader = (
    <>
      <div className="d2-demo">
        <span>Ателье Beauty Bar · ЖК «Европолис» · Сатпаева, 316 (4.8★)</span>
        <a href="/proposal/">
          Для владельца <ArrowUpRight size={13} />
        </a>
      </div>
      <header className="d2-header d2-wrap">
        <a className="d2-wordmark" href="#top" aria-label={studio.name + ", главная"}>
          {branding.logo_url ? (
            <img src={String(branding.logo_url)} alt={brand("name", studio.name)} />
          ) : (
            brand("name","Ателье")
          )}
          <small>BEAUTY ATELIER</small>
        </a>
        <nav aria-label="Основная навигация">
          <a href="#services">Услуги</a>
          <a href="#looks">Образы</a>
          <a href="#signature">Доска идей</a>
          <a href="#place">Контакты</a>
        </nav>
        <div className="d2-actions">
          <button
            type="button"
            className="d2-theme-toggle"
            aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
            title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button aria-label="Мои записи" onClick={() => setPanel({ type: "appointments" })}>
            <CalendarDays size={20} />
          </button>
          <button aria-label="Сохранённые образы" onClick={() => setPanel({ type: "saved" })}>
            <Heart size={20} />
          </button>
          <button
            className="d2-basket"
            aria-label={`Мой визит, услуг: ${visitIds.length}`}
            onClick={() => book()}
          >
            <ShoppingBag size={20} />
            {visitIds.length > 0 && <b>{visitIds.length}</b>}
          </button>
          <button className="d2-quick" onClick={() => book()}>
            Записаться <ArrowUpRight size={17} />
          </button>
          <button
            className="d2-menu"
            aria-label={menu ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>
      {menu && (
        <nav className="d2-mobile-nav d2-wrap" aria-label="Мобильная навигация">
          {[
            ["Услуги", "services"],
            ["Образы", "looks"],
            ["Доска идей", "signature"],
            ["Контакты", "place"],
          ].map(([label, id]) => (
            <a href={`#${id}`} key={id} onClick={() => setMenu(false)}>
              {label}
              <ArrowUpRight size={20} />
            </a>
          ))}
          <button type="button" className="d2-mobile-theme" onClick={toggleTheme}>
            <span>{theme === "dark" ? "Светлая тема" : "Тёмная тема"}</span>
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </nav>
      )}
    </>
  );

  const contact = (
    <section className="d2-place d2-wrap" id="place">
      <div>
        <span className="d2-eyebrow">ДО ВСТРЕЧИ / ПАВЛОДАР</span>
        <h2>Продолжим<br/><em>в Ателье.</em></h2>
        <p>{branches[0].address}</p>
        <a
          className="d2-link"
          href={brand("mapsUrl", studio.mapsUrl || "#")}
          target="_blank"
          rel="noreferrer"
        >
          Маршрут в 2ГИС <ArrowUpRight size={19} />
        </a>
      </div>
      <div className="d2-place-details">
        <div>
          <span>ЧАСЫ РАБОТЫ</span>
          <p>{brand("hours", studio.hours)}</p>
        </div>
        <div>
          <span>ОБСУДИТЬ ВИЗИТ</span>
          <a href={`tel:+${brand("phone_satpaeva", studio.whatsapp || "")}`}>
            {brand("phone_satpaeva", studio.whatsapp || "").replace(
              /^7(\d{3})(\d{3})(\d{2})(\d{2})$/,
              "+7 $1 $2-$3-$4"
            )}
          </a>
        </div>
        <a
          className="d2-button"
          href={`https://wa.me/${brand("phone_satpaeva", studio.whatsapp || "")}`}
          target="_blank"
          rel="noreferrer"
        >
          Написать в WhatsApp <ArrowUpRight size={19} />
        </a>
      </div>
    </section>
  );

  const siteFooter = (
    <>
      <section className="d2-reviews d2-wrap">
        <div>
          <span className="d2-eyebrow">ВАШИ ВПЕЧАТЛЕНИЯ</span>
          <h2>
            Как прошёл<br />
            <em>ваш визит?</em>
          </h2>
        </div>
        <div>
          <p>Мы ценим каждого гостя. Поделитесь вашими впечатлениями или оставьте оценку в 2ГИС.</p>
          <button className="d2-link" onClick={() => setPanel({ type: "review" })}>
            Оставить отзыв <Plus size={19} />
          </button>
          <a
            className="d2-link"
            href={`${branches[0].map}/tab/reviews`}
            target="_blank"
            rel="noreferrer"
          >
            Читать в 2ГИС <ArrowUpRight size={19} />
          </a>
        </div>
        {reviews.length > 0 && (
          <div className="d2-review-list">
            {reviews.slice(0, 3).map((r) => (
              <article key={r.id}>
                <small>{r.rating} / 5</small>
                <p>{r.text}</p>
                <strong>{r.author}</strong>
              </article>
            ))}
          </div>
        )}
      </section>
      <footer className="d2-footer d2-wrap">
        <a className="d2-wordmark" href="#top">
          {brand("name","Ателье")}
        </a>
        <div>
          <a href={brand("instagramUrl", studio.instagramUrl || "#")} target="_blank" rel="noreferrer">
            Instagram <ArrowUpRight size={14} />
          </a>
          <button onClick={() => setPanel({ type: "privacy" })}>Конфиденциальность</button>
          <a href="/manage/">Для команды</a>
          <a href="/proposal/">Предложение</a>
        </div>
        <small>
          © 2026 {studio.name} · г. Демонстрация, {branches[0].address}.<br />
          Онлайн-запись и связь через WhatsApp. Все права защищены.
        </small>
      </footer>
    </>
  );

  const floating = visitIds.length > 0 && (
    <button className="d2-floating" onClick={() => book()}>
      <ShoppingBag size={19} />
      <span>Мой визит · {visitIds.length}</span>
      <ArrowUpRight size={21} />
    </button>
  );

  return (
    <CatalogContext.Provider value={content}>
      <div className="d2-site deesse" data-theme={theme}><a className="skip-link" href="#services">Перейти к услугам</a>{siteHeader}<main id="top">
<section className="ds-cover d2-wrap"><span className="d2-eyebrow">АТЕЛЬЕ / АТЕЛЬЕ ВАШЕГО ОБРАЗА</span><div className="ds-cover-title"><h1>Найти<br/><em>свой оттенок.</em></h1><p>Начните с ощущения.<br/>Форма, цвет и детали<br/>сложатся в ваш образ.</p></div><div className="ds-cover-art"><Photo name={brand("hero_image","woman")} width="1200" height="1500" sizes="(max-width:650px) 100vw, 60vw" alt="Текстурная стрижка и контуринг волос" fetchPriority="high"/><span className="ds-cover-caption">ФОРМА И ЦВЕТ / АТЕЛЬЕ ЦВЕТА</span><a className="ds-cover-cta" href="#signature"><ArrowUpRight size={34}/><span>Собрать<br/>доску идей</span></a></div><div className="ds-cover-foot"><span>ДЕМОНСТРАЦИЯ / ПОРТФОЛИО</span><span>ВОЛОСЫ / НОГТИ / ВЗГЛЯД</span></div></section>
<section id="looks" className="ds-looks d2-wrap"><div className="d2-section-title"><span className="d2-eyebrow">ГЛАВА 01 / ПРИСМОТРЕТЬСЯ</span><h2>То, что<br/><em>откликается.</em></h2><p>Рассмотрите детали. Сохраните идею. Окончательную форму подберёте вместе с мастером.</p></div>{filters}<div className="d2-gallery">{filtered.map(card)}</div><p className="d2-disclosure">Коллекция оттенков и форм. Сохраните ориентиры для консультации со стилистом.</p></section>
<section id="signature" className="ds-board"><div className="d2-wrap"><div className="d2-section-title"><span className="d2-eyebrow">ГЛАВА 02 / МОЯ ДОСКА ИДЕЙ</span><h2>Лучше показать,<br/><em>чем объяснять.</em></h2><p>Выберите до трёх ориентиров. Добавьте пожелание — оно сохранится вместе с визитом.</p></div><div className="ds-board-pictures">{looks.filter(l=>l.audience==="women").slice(0,5).map((l,i)=><button key={l.id} aria-label={`В доску идей: ${l.title}`} aria-pressed={ideaIds.includes(l.id)} className={ideaIds.includes(l.id)?"selected":""} onClick={()=>setIdeaIds(prev=>prev.includes(l.id)?prev.filter(id=>id!==l.id):prev.length<3?[...prev,l.id]:prev)}><Photo name={l.image} alt={l.title} width="480" height="600" loading="lazy"/><span><small>0{i+1}</small>{l.title}{ideaIds.includes(l.id)&&<Check size={20}/>}</span></button>)}</div><div className="ds-board-bottom"><label>Что хочется сохранить или изменить?<textarea rows={3} maxLength={350} value={ideaNote} onChange={e=>setIdeaNote(e.target.value)} placeholder="Например: сохранить длину, сделать цвет теплее"/></label><div><span className="d2-eyebrow" aria-live="polite">ВЫБРАНО {ideaIds.length} ИЗ 3</span><button className="d2-button" data-testid="signature-add" disabled={!ideaIds.length} onClick={()=>addBundle(selectedIdeas.map(l=>l.serviceId),["Моя доска идей: "+selectedIdeas.map(l=>l.title).join(", "),ideaNote].filter(Boolean).join(". "),ideaIds)}>Сохранить идею к визиту <ArrowUpRight size={20}/></button><p>Это ориентир для консультации. Стоимость и технику согласуем до процедуры.</p></div></div></div></section>
<section id="services" className="ds-services d2-wrap"><div className="d2-section-title"><span className="d2-eyebrow">ГЛАВА 03 / ВЫБРАТЬ УСЛУГУ</span><h2>От идеи<br/><em>к деталям.</em></h2></div><div className="ds-service-tabs" role="group" aria-label="Направление услуг">{groups.map(g=><button key={g.id} className={activeGroup===g.id?"active":""} aria-pressed={activeGroup===g.id} onClick={()=>setActiveGroup(g.id)}>{g.title}</button>)}</div><div className="d2-service-list">{groupServices.map(renderService)}</div><div className="ds-service-note"><p>Все мастера работают по единым стандартам премиального качества.</p><button className="d2-link" onClick={()=>book()}>Мой визит <ArrowUpRight size={18}/></button></div></section>
{contact}</main>{siteFooter}{floating}</div>
      {panel && (
        <Modal
          key={panel.type}
          title={
            panel.type === "visit"
              ? "Онлайн-запись"
              : panel.type === "look"
                ? "Образ"
                : panel.type === "appointments"
                  ? "Мои записи"
                  : panel.type === "review"
                    ? "Оставить отзыв"
                    : panel.type === "saved"
                      ? "Моя подборка"
                      : "Конфиденциальность"
          }
          onClose={close}
          variant={
            panel.type === "visit"
              ? "booking-modal"
              : panel.type === "look"
                ? "hn-look-modal"
                : ""
          }
        >
          {panel.type === "visit" && (
            <VisitPlanner
              wishes={visitWishes}
              onWishesChange={setVisitWishes}
              ids={visitIds}
              lookIds={visitLookIds}
              initialBranch={panel.options.branchId}
              onChange={setVisitIds}
              onClear={() => {
                setVisitIds([]);
                setVisitLookIds([]);
                setVisitWishes("");
              }}
              notify={setToast}
              onAppointments={() => setPanel({ type: "appointments" })}
            />
          )}
          {panel.type === "appointments" && (
            <Appointments
              initialToken={panel.token}
              notify={setToast}
              onBook={() => book()}
            />
          )}
          {activeLook && (
            <LookDetails
              key={activeLook.id}
              look={activeLook}
              saved={saved.includes(activeLook.id)}
              inVisit={visitIds}
              onSave={() => save(activeLook.id)}
              onAdd={addToVisit}
              onVisit={() => book()}
              onBrowse={close}
            />
          )}
          {panel.type === "saved" && (
            <div className="hn-dialog-content">
              <span className="hn-kicker">ВАШЕ ВДОХНОВЕНИЕ</span>
              <h2>Моя подборка</h2>
              {saved.length ? (
                <>
                  <div className="hn-saved-grid">
                    {looks.filter((l) => saved.includes(l.id)).map(card)}
                  </div>
                  <button
                    className="hn-btn"
                    onClick={() => book({ lookIds: saved })}
                  >
                    Добавить к визиту <ArrowUpRight size={18} />
                  </button>
                </>
              ) : (
                <p>
                  Сохраните понравившиеся образы, нажав на сердце рядом с
                  фотографией.
                </p>
              )}
            </div>
          )}
          {panel.type === "review" && (
            <div className="hn-dialog-content">
              <span className="hn-kicker">ПОСЛЕ ВИЗИТА</span>
              <h2>Ваше впечатление</h2>
              <p>
                Отзыв появится после модерации. Телефон публиковать не нужно.
              </p>
              <form className="hn-form" onSubmit={submitReview}>
                <label>
                  Имя
                  <input name="author" required minLength={2} maxLength={80} />
                </label>
                <label>
                  Оценка
                  <select name="rating" defaultValue="5">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} из 5
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Филиал
                  <select name="branch">
                    {branches.map((b) => (
                      <option key={b.id}>{b.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Впечатление
                  <textarea
                    name="text"
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={4}
                  />
                </label>
                <input
                  name="website"
                  className="hn-honeypot"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />
                <label className="hn-consent">
                  <input type="checkbox" required />
                  Согласен на публикацию имени и отзыва после модерации
                </label>
                <button className="hn-btn" disabled={sending}>
                  {sending ? "Отправляем…" : "Отправить отзыв"}
                  <ArrowUpRight size={17} />
                </button>
              </form>
            </div>
          )}
          {panel.type === "privacy" && (
            <div className="hn-dialog-content">
              <h2>Конфиденциальность</h2>
              <p>
                Для записи сохраняются имя, телефон, дата, услуга и пожелания.
                Они доступны только администратору салона и по личной ссылке
                визита. Не передавайте её другим людям.
              </p>
              <p>
                Отправка WhatsApp подтверждает бронирование с администратором.
                Отзывы публикуются после подтверждения визита. Для изменения или
                отмены записи свяжитесь с администратором выбранного филиала.
              </p>
              <p>
                Персональные данные используются исключительно для подтверждения
                визита и связи администратора с вами.
              </p>
            </div>
          )}
        </Modal>
      )}
      {toast && (
        <div className="hn-toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </CatalogContext.Provider>
  );
}
