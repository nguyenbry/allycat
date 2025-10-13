import * as React from "react";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  biasAtom,
  endIdAtom,
  passwordAtom,
  type SelectedPlaceAtom,
  selectedPlacesAtom,
  selectedPlacesAtomsAtom,
  startIdAtom,
} from "./atoms";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { KeyRound, LocateFixed, Route } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { MoreVerticalIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type PropsWithCn } from "@/components/types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Sidebar() {
  const [password, setPassword] = useAtom(passwordAtom);

  const passwordIsInvalid = password.trim() === "";

  return (
    <div className="sticky top-0 h-screen w-1/5 self-stretch">
      <div className="bg-sidebar absolute inset-3 flex flex-col overflow-clip rounded-lg border shadow-md dark:border-transparent">
        <ScrollArea className={`h-full pb-[var(--calculate-area-height)]`}>
          <div className="bg-border absolute inset-x-0 bottom-[var(--calculate-area-height)] h-[1px]"></div>
          <div className="bg-card absolute inset-x-0 bottom-0 flex h-[var(--calculate-area-height)] p-3">
            {/* ensure button fits in height */}
            <Button
              size={"sm"}
              className="grow self-center"
              variant={"outline"}
            >
              Calculate
            </Button>
          </div>
          <div className="p-3">
            <InputGroup>
              <InputGroupInput
                aria-invalid={passwordIsInvalid}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <InputGroupAddon>
                <KeyRound />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <KeyRound />
              </InputGroupAddon>
            </InputGroup>
          </div>

          {/* {Array.from({ length: 20 }).map((_, i) => {
            return <div>{i}</div>;
          })} */}
          <PlacesAdded />
          {/* <ThemeToggle className="mt-auto mb-2 self-center" /> */}
        </ScrollArea>
      </div>
    </div>
  );
}

function PlaceControlDropdownMenu({ className }: PropsWithCn) {
  const placeAtom = useSelectedPlaceAtom();
  const place = useAtomValue(placeAtom);

  const setStart = useSetAtom(startIdAtom);
  const setEnd = useSetAtom(endIdAtom);

  const [bias, setBias] = useAtom(biasAtom);

  const setPlaces = useSetAtom(selectedPlacesAtom);

  const isBias = bias === place.id;

  const biasLabel = isBias ? "Remove location bias" : "Set as location bias";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="More Options"
          className={className}
        >
          <MoreVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant={isBias ? "destructive" : undefined}
            onSelect={() => {
              if (isBias) {
                setBias(undefined);
              } else {
                setBias(place.id);
              }
            }}
          >
            <LocateFixed />
            {biasLabel}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={() => {
              setStart(place.id);
            }}
          >
            <Route />
            Designate start location
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setEnd(place.id);
            }}
          >
            <Route />
            Designate end location
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setPlaces((places) => places.filter((x) => x.id !== place.id));
              setStart((id) => (id === place.id ? undefined : id));
              setEnd((id) => (id === place.id ? undefined : id));
              setBias((id) => (id === place.id ? undefined : id));
            }}
          >
            <Trash2Icon />
            Remove location
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Badges() {
  const place = useAtomValue(useSelectedPlaceAtom());
  const biasLocationId = useAtomValue(biasAtom);
  const isBias = biasLocationId === place.id;

  const startId = useAtomValue(startIdAtom);
  const isStart = place.id === startId;

  const endId = useAtomValue(endIdAtom);
  const isEnd = endId === place.id;

  return (
    <AnimatePresence>
      {isBias && (
        <Badge variant={"outline"} asChild key={"bias"}>
          <motion.span
            initial={{ y: 30, opacity: 0, scale: 0.7 }}
            animate={{
              y: 0,
              opacity: 1,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              scale: 0.8,
              transition: { duration: 0.2 },
            }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
              mass: 1,
            }}
          >
            Bias
          </motion.span>
        </Badge>
      )}
      {isStart && (
        <Badge variant={"jade"} asChild key={"start"}>
          <motion.span
            initial={{ y: 30, opacity: 0, scale: 0.7 }}
            animate={{
              y: 0,
              opacity: 1,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: -30,
              scale: 0.8,
              transition: { duration: 0.4 },
            }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
              mass: 1,
            }}
          >
            Start
          </motion.span>
        </Badge>
      )}
      {isEnd && (
        <Badge variant={"destructive"} asChild key={"end"}>
          <motion.span
            initial={{ y: 30, opacity: 0, scale: 0.7 }}
            animate={{
              y: 0,
              opacity: 1,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              scale: 0.8,
              transition: { duration: 0.2 },
            }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
              mass: 1,
            }}
          >
            End
          </motion.span>
        </Badge>
      )}
    </AnimatePresence>
  );
}

const SelectedPlaceAtomContext = React.createContext<
  SelectedPlaceAtom | undefined
>(undefined);

function useSelectedPlaceAtom() {
  const a = React.use(SelectedPlaceAtomContext);
  if (!a) {
    throw new Error(
      "useSelectedPlaceAtom must be used within a SelectedPlaceAtomContext.Provider"
    );
  }
  return a;
}

function PlacesAdded() {
  const placesAtoms = useAtomValue(selectedPlacesAtomsAtom);

  return (
    <ul className="list-decimal pr-2 pl-7">
      <AnimatePresence>
        {placesAtoms.map((a) => {
          return (
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            <SelectedPlaceAtomContext.Provider key={`${a}`} value={a}>
              <PlaceCard />
            </SelectedPlaceAtomContext.Provider>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

function PlaceCard() {
  const placeAtom = useSelectedPlaceAtom();
  const place = useAtomValue(placeAtom);

  return (
    <motion.li
      initial={{ y: 30, opacity: 0, scale: 0.7 }}
      animate={{
        y: 0,
        opacity: 1,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        scale: 0.8,
        transition: { duration: 0.2 },
      }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 30,
        mass: 1,
      }}
      className="marker:text-muted-foreground py-2 pl-1.5 marker:text-sm"
    >
      <div className="flex gap-2">
        <div className="inline-flex flex-col gap-0.5">
          <span className="text-sm">{place.displayName.text}</span>
          <span className="text-muted-foreground text-xs">
            {place.formattedAddress}
          </span>
          <div className="flex flex-wrap gap-1">
            <Badges />
          </div>
        </div>
        {/* <div className="ml-auto inline-flex shrink-0 gap-1 self-center">
                <Button size="icon-xs" variant="outline">
                  <X className="size-3" />
                </Button>
              </div> */}
        <PlaceControlDropdownMenu className="ml-auto self-center" />
      </div>
    </motion.li>
  );
}
