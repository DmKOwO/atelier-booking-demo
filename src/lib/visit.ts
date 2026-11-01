import type { Service } from "../data/studio";
export const visitTotal = (
  items: Pick<Service, "price" | "priceMax" | "priceOnRequest">[],
) => {
  const min = items.reduce((s, x) => s + (x.priceOnRequest ? 0 : x.price), 0);
  const max = items.reduce(
    (s, x) => s + (x.priceOnRequest ? 0 : x.priceMax || x.price),
    0,
  );
  const unknown = items.some((x) => x.priceOnRequest);
  const fmt = (n: number) => new Intl.NumberFormat("ru-KZ").format(n);
  return min === 0 && unknown
    ? "По согласованию"
    : `${fmt(min)}${max !== min ? "–" + fmt(max) : ""} ₸${unknown ? " + услуги по согласованию" : ""}`;
};
export function relatedServiceIds(service: Service, services: Service[]) {
  if (service.audience === "nails")
    return [
      "mani-all-inclusive",
      "japanese-manicure",
      "hardware-manicure-no-cover",
      "nail-extension",
    ];
  if (service.id.startsWith("brow-"))
    return services.filter((s) => s.id.startsWith("brow-")).map((s) => s.id);
  if (service.id.startsWith("color-"))
    return services.filter((s) => s.id.startsWith("color-")).map((s) => s.id);
  if (service.id.includes("perm"))
    return services
      .filter((s) => s.id.includes("perm") && s.audience === service.audience)
      .map((s) => s.id);
  if (
    ["hairstyle-bun-ponytail", "festive-curls", "daily-curls"].includes(
      service.id,
    )
  )
    return [
      "hairstyle-bun-ponytail",
      "festive-curls",
      "daily-curls",
      "wash-blowdry-shape",
    ];
  if (service.audience === "men")
    return [service.id];
  if (service.audience === "women") return [service.id];
  return [service.id];
}
export function recommendations(selected: Service[], all: Service[]) {
  const ids = new Set(selected.map((s) => s.id));
  const suggestions: string[] = [];
  if (selected.some((s) => s.audience === "nails"))
    suggestions.push(
      "pedi-smart-all-inclusive",
      "hand-paraffin",
      "brow-henna",
    );
  if (selected.some((s) => s.audience === "women"))
    suggestions.push("mani-all-inclusive", "brow-henna", "spa-cold-short");
  if (selected.some((s) => s.audience === "men"))
    suggestions.push("men-beard");
  if (selected.some((s) => s.audience === "care"))
    suggestions.push("mani-all-inclusive", "wash-blowdry-shape");
  if (selected.some(s => s.audience === "care")) suggestions.push("mani-all-inclusive", "women-cut");
  return [...new Set(suggestions)]
    .filter((id) => !ids.has(id))
    .map((id) => all.find((s) => s.id === id))
    .filter((s): s is Service => !!s)
    .slice(0, 3);
}
export function mergeVisitService(ids: string[], id: string) {
  const family = (s: string) =>
    [
      "mani-all-inclusive",
      "japanese-manicure",
      "hardware-manicure-no-cover",
    ].includes(s)
      ? "manicure"
      : s.startsWith("color-")
        ? "hair-color"
        : s.startsWith("bio-perm-")
          ? "perm"
          : s.startsWith("spa-cold-")
            ? "hair-care"
            : s.startsWith("pedi-")
              ? "pedicure"
              : null;
  const current = family(id);
  return [
    ...ids.filter((old) => old !== id && (!current || family(old) !== current)),
    id,
  ];
}
