import { createContext, useContext } from "react";
import {
  services,
  masters,
  looks,
  branches,
  studio,
  reviews,
} from "../data/studio";
import data from "../data/catalog.json";
export const defaultCatalog = {
  services,
  masters,
  looks,
  branches,
  branding: studio as Record<string, unknown>,
  reviews,
  groups: data.serviceGroups,
};
export type PublicCatalog = typeof defaultCatalog;
export const CatalogContext = createContext<PublicCatalog>(defaultCatalog);
export const useCatalog = () => useContext(CatalogContext);
export const imageUrl = (image:string,size=960) => image.startsWith('data:') ? image : ((window as any).DEMO_ASSETS[image.replace('/images/','')] || (window as any).DEMO_ASSETS[`${image}-${size}.webp`] || image);
