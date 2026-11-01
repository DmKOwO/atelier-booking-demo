import { useState } from "react";
import { ArrowUpRight, Check, Copy, MapPin, Phone } from "lucide-react";
import { branches, services, looks } from "../data/studio";
import type { BookingOptions } from "./Booking";

export default function RequestBooking({
  options,
  saved,
  onCalendar,
}: {
  options: BookingOptions;
  saved: string[];
  onCalendar: () => void;
}) {
  const [branchId, setBranchId] = useState(branches[0].id);
  const [serviceId, setServiceId] = useState(
    options.serviceId ?? services[0].id,
  );
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const branch = branches.find((b) => b.id === branchId)!;
  const service = services.find((s) => s.id === serviceId)!;
  const chosen = looks.filter((l) =>
    [...saved, ...(options.lookIds ?? [])].includes(l.id),
  );
  const message = [
    "Здравствуйте! Хочу уточнить запись в Ателье.",
    `Филиал: ${branch.name}.`,
    `Услуга: ${service.name}.`,
    date ? `Желаемый день: ${date.split("-").reverse().join(".")}.` : "",
    time ? `Удобное время: ${time}.` : "",
    note ? `Пожелания: ${note}` : "",
    chosen.length
      ? `Вдохновение: ${chosen.map((l) => l.title).join(", ")}. Примеры обсудим в переписке.`
      : "",
    "Подскажите, пожалуйста, свободное время и актуальную стоимость.",
  ]
    .filter(Boolean)
    .join("\n");
  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="request-booking">
      <span className="eyebrow">ВАШ ПРИВЫЧНЫЙ WHATSAPP</span>
      <h2>
        Начнём <span className="serif">с пожеланий.</span>
      </h2>
      <p className="request-lead">
        Выберите услугу и филиал. Администратор подскажет время, стоимость и
        подходящего специалиста.
      </p>
      <div className="request-branches" role="group" aria-label="Выбор филиала">
        {branches.map((b) => (
          <button
            type="button"
            key={b.id}
            className={b.id === branchId ? "selected" : ""}
            aria-pressed={b.id === branchId}
            onClick={() => setBranchId(b.id)}
          >
            <MapPin size={18} />
            <span>
              {b.name}
              <small>Демонстрация</small>
            </span>
            {b.id === branchId && <Check size={18} />}
          </button>
        ))}
      </div>
      <label className="request-label">
        Что хотите сделать?
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="request-fields">
        <label className="request-label">
          Желаемый день
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toLocaleDateString("en-CA", {
              timeZone: "Asia/Qostanay",
            })}
          />
        </label>
        <label className="request-label">
          Когда удобно?
          <select value={time} onChange={(e) => setTime(e.target.value)}>
            <option value="">Любое время</option>
            <option>До обеда</option>
            <option>После обеда</option>
            <option>После 18:00</option>
          </select>
        </label>
      </div>
      <label className="request-label">
        Пожелания <span>необязательно</span>
        <textarea
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Например: хочу посоветоваться насчёт окрашивания"
          rows={3}
        />
      </label>
      <div className="request-preview">
        <span className="eyebrow">ГОТОВОЕ СООБЩЕНИЕ</span>
        <pre>{message}</pre>
        <button className="text-button" type="button" onClick={copy}>
          {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
          {copied ? "Скопировано" : "Скопировать сообщение"}
        </button>
      </div>
      <p className="request-demo-note">
        Кнопка ниже откроет прямой диалог в WhatsApp с администратором салона
        с уже подготовленным текстом для согласования деталей.
      </p>
      <a
        className="button button-blue request-send"
        href={`https://wa.me/${branch.phone}?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noreferrer"
      >
        Уточнить время в WhatsApp <ArrowUpRight size={20} />
      </a>
      <p className="fine-print">
        Запись подтвердит администратор. Выбранный день — пожелание, свободное
        время здесь не бронируется. Эти поля не отправляются на сервер сайта.
      </p>
      <div className="request-bottom">
        <a href={`tel:+${branch.phone}`}>
          <Phone size={16} /> Позвонить
        </a>
        <button type="button" onClick={onCalendar}>
          Выбрать время в календаре ↗
        </button>
      </div>
    </div>
  );
}
