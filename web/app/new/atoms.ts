import { type placeSchema } from "@/fetcher/fetchers";
import { atom, type ExtractAtomValue } from "jotai";
import { splitAtom } from "jotai/utils";

export const queryAtom = atom("");
export const passwordAtom = atom("");
export const selectedPlacesAtom = atom<placeSchema[]>([]);

export const selectedPlacesAtomsAtom = splitAtom(
  selectedPlacesAtom,
  (x) => x.id
);

export const biasAtom = atom<string | undefined>(undefined);
export const startIdAtom = atom<string | undefined>(undefined);
export const endIdAtom = atom<string | undefined>(undefined);

export type SelectedPlaceAtom = ExtractAtomValue<
  typeof selectedPlacesAtomsAtom
>[number];
