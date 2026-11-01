import catalog from "./catalog.json";

export type Audience =
  "all" | "women" | "men" | "kids" | "nails" | "care" | "combos";
export type ServiceKind =
  "all" | "cut" | "color" | "style" | "nails" | "care" | "combos";
export type Shift = {
  weekday: number;
  enabled: boolean;
  start: string;
  end: string;
  breakStart: string;
  breakEnd: string;
};
export interface Master {
  id: string;
  name: string;
  initials: string;
  role: string;
  description: string;
  tags: string[];
  color: string;
  number: string;
  image: string;
  serviceIds: string[];
  schedule: Shift[];
  branchIds?: string[];
  demo?: boolean;
}
export interface Look {
  id: string;
  title: string;
  subtitle: string;
  audience: Audience;
  kind: ServiceKind;
  image: string;
  masterId: string;
  serviceId: string;
  tags: string[];
  description: string;
  care: string;
  position: string;
  source?: string;
  custom?: boolean;
}
export interface Service {
  id: string;
  audience: Audience;
  name: string;
  detail: string;
  duration: string;
  durationMinutes: number;
  price: number;
  from: boolean;
  priceMax?: number;
  priceOnRequest?: boolean;
  enabled?: boolean;
  masterIds?: string[];
  badge?: string;
}

export interface SpecialOffer {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  price: number;
  duration: string;
  badge: string;
  savings: string;
  serviceId: string;
  image: string;
}

// Единый каталог используется и сайтом, и сервером записи.
export const studio = catalog.studio as Omit<
  typeof catalog.studio,
  "whatsapp" | "address" | "mapsUrl" | "instagramUrl"
> & {
  whatsapp: string | null;
  address: string | null;
  mapsUrl: string | null;
  instagramUrl: string | null;
  subdomain?: string;
  platformUrl?: string;
};
export const audiences = catalog.audiences as { id: Audience; label: string }[];
export const masters = catalog.masters as Master[];
export const looks = catalog.looks as Look[];
export const services = catalog.services as Service[];
export const specialOffers = ((catalog as { specialOffers?: SpecialOffer[] })
  .specialOffers || []) as SpecialOffer[];
export const money = (amount: number) =>
  new Intl.NumberFormat("ru-KZ").format(amount) + " ₸";
export const servicePrice = (service: Service) =>
  service.priceOnRequest
    ? "По согласованию"
    : service.priceMax
      ? new Intl.NumberFormat("ru-KZ").format(service.price) +
        "–" +
        money(service.priceMax)
      : (service.from ? "от " : "") + money(service.price);

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  rating?: string;
  reviewsCount?: number;
  award?: string;
  map: string;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  branch: string;
  service: string;
  text: string;
  source: string;
  verified: boolean;
  status?: "pending" | "published";
}

export const branches = catalog.branches as Branch[];
export const reviews = ((catalog as unknown as { reviews?: Review[] }).reviews ||
  []) as Review[];
