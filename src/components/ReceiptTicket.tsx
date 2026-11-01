import { useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Printer,
  ArrowUpRight,
} from "lucide-react";
import { useCatalog } from "../lib/catalog";
import { calendarDownload, dateLabel, type Appointment } from "../lib/booking";
import { servicePrice } from "../data/studio";
export default function ReceiptTicket({
  appointment: a,
  branchId,
  notify,
}: {
  appointment: Appointment;
  branchId?: string;
  notify?: (m: string) => void;
}) {
  const { branches } = useCatalog(),
    [details, setDetails] = useState(false);
  const branch =
    branches.find((b) => b.id === (a.branchId || branchId)) || branches[0];
  const message = `Здравствуйте! Запись ${a.reference}: ${a.serviceName}, ${dateLabel(a.date)} в ${a.time}. ${branch.name}. Имя: ${a.name}.`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${message}\n${location.origin}/#appointment/${a.token}`,
      );
      notify?.("Детали визита скопированы");
    } catch {
      notify?.("Откройте «Мои записи», чтобы посмотреть визит");
    }
  }
  return (
    <div className="hn-ticket-wrap">
      <article className="hn-ticket receipt-ticket">
        <header>
          <span className="hn-kicker">АТЕЛЬЕ / КАРТОЧКА ВИЗИТА</span>
          <div className="hn-ticket-check">
            <Check size={24} />
          </div>
          <h3>
            Время для вас
            <br />
            <em>забронировано.</em>
          </h3>
          <span className="hn-ticket-reference">{a.reference}</span>
        </header>
        <dl>
          <div>
            <dt>Услуга</dt>
            <dd>{a.serviceName}</dd>
          </div>
          <div>
            <dt>Мастер</dt>
            <dd>{a.masterName}</dd>
          </div>
          <div>
            <dt>Когда</dt>
            <dd>
              {dateLabel(a.date)}, {a.time}–{a.endTime}
            </dd>
          </div>
          <div>
            <dt>Где</dt>
            <dd>{branch.name}</dd>
          </div>
        </dl>
        <div className="hn-ticket-total">
          <span>Стоимость услуги</span>
          <strong>{servicePrice(a as any)}</strong>
        </div>
        <p className="hn-ticket-status">
          Оплата в салоне. Деньги на сайте не списывались.
        </p>
        <button
          className="hn-ticket-expand"
          onClick={() => setDetails(!details)}
          aria-expanded={details}
        >
          Детали визита <ChevronDown size={16} />
        </button>
        {details && (
          <div className="hn-ticket-details">
            <p>Гость: {a.name}</p>
            <p>Телефон: {a.phone}</p>
            {a.note && <p>Пожелания: {a.note}</p>}
            <p>Длительность: {a.durationMinutes} мин.</p>
            <p>Это подтверждение записи, не фискальный чек.</p>
          </div>
        )}
        <footer>
          <span>ДО ВСТРЕЧИ</span>
          <span>АТЕЛЬЕ</span>
        </footer>
      </article>
      <div className="hn-ticket-actions">
        <button className="hn-btn" onClick={() => calendarDownload(a)}>
          <CalendarDays size={16} />В календарь
        </button>
        <button className="hn-text-btn" onClick={copy}>
          <Copy size={15} />
          Скопировать детали
        </button>
        <button className="hn-text-btn" onClick={() => window.print()}>
          <Printer size={15} />
          Сохранить / печать
        </button>
      </div>
      <a
        className="hn-ticket-whatsapp"
        href={`https://wa.me/${branch.phone}?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noreferrer"
      >
        Написать в филиал <ArrowUpRight size={15} />
      </a>
      <p className="hn-ticket-hint">
        WhatsApp откроет подготовленное сообщение. Для отправки нажмите кнопку в
        приложении.
      </p>
    </div>
  );
}
