import { useState } from "react";
import { ArrowUpRight, Check, Heart, Plus } from "lucide-react";
import Photo from "./Photo";
import { useCatalog, imageUrl } from "../lib/catalog";
import { relatedServiceIds } from "../lib/visit";
import { servicePrice, type Look } from "../data/studio";
export default function LookDetails({
  look,
  saved,
  inVisit,
  onSave,
  onAdd,
  onVisit,
  onBrowse,
}: {
  look: Look;
  saved: boolean;
  inVisit: string[];
  onSave: () => void;
  onAdd: (serviceId: string, lookId: string) => void;
  onVisit: () => void;
  onBrowse: () => void;
}) {
  const { services } = useCatalog();
  const original = services.find((s) => s.id === look.serviceId);
  const variants = original
    ? relatedServiceIds(original, services)
        .map((id) => services.find((s) => s.id === id))
        .filter((s) => !!s)
    : [];
  if (original && !variants.some((s) => s.id === original.id))
    variants.unshift(original);
  const [id, setId] = useState(original?.id || variants[0]?.id || "");
  const service = services.find((s) => s.id === id);
  const added = inVisit.includes(id);
  return (
    <div className="hn-look-detail">
      <Photo
        name={look.image}
        sizes="(max-width:600px) 100vw, 520px"
        alt={look.title}
        style={{ objectPosition: look.position }}
      />
      <div>
        <span className="hn-kicker">
          {look.custom ? "РАБОТА САЛОНА" : "ИДЕЯ ДЛЯ ВАШЕГО ВИЗИТА"}
        </span>
        <h2>{look.title}</h2>
        <p>{look.description}</p>
        <label className="hn-look-variant">
          Какую услугу вы хотите?
          <select
            aria-label="Вариант услуги"
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            {variants.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {servicePrice(s)}
              </option>
            ))}
          </select>
        </label>
        <p className="hn-look-explanation">
          Фото — ориентир. Выберите подходящий вариант: вид процедуры и
          результат можно обсудить с мастером.
        </p>
        <strong>{service ? servicePrice(service) : "По согласованию"}</strong>
        <button
          className="hn-btn"
          disabled={!service}
          onClick={() => service && onAdd(service.id, look.id)}
        >
          {added ? (
            <>
              <Check size={18} />
              Добавлено в мой визит
            </>
          ) : (
            <>
              <Plus size={18} />
              Добавить в мой визит
            </>
          )}
        </button>
        {added && (
          <button className="hn-btn hn-btn-outline" onClick={onVisit}>
            Посмотреть мой визит <ArrowUpRight size={18} />
          </button>
        )}
        <div className="hn-look-secondary">
          <button className="hn-text-btn" onClick={onBrowse}>
            Продолжить выбор <ArrowUpRight size={17} />
          </button>
          <button className="hn-text-btn" onClick={onSave}>
            <Heart size={17} fill={saved ? "currentColor" : "none"} />
            {saved ? "Сохранено" : "Сохранить образ"}
          </button>
        </div>
        <p className="hn-fine">
          Можно добавить несколько услуг. Выбор мастера и времени будет
          следующим шагом. Оплата — в салоне.
        </p>
      </div>
    </div>
  );
}
