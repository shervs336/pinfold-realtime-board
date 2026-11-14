import { PEOPLE_COLORS } from "./types";

const ADJ = ["Curious", "Brave", "Quiet", "Swift", "Clever", "Sunny", "Bold", "Calm", "Witty", "Lucky"];
const ANIMAL = ["Otter", "Falcon", "Fox", "Heron", "Lynx", "Panda", "Koala", "Wren", "Bison", "Gecko"];

/** A friendly default name + color for people who join without an account. */
export function randomIdentity(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    display_name: `${ADJ[h % ADJ.length]} ${ANIMAL[(h >>> 4) % ANIMAL.length]}`,
    color: PEOPLE_COLORS[(h >>> 8) % PEOPLE_COLORS.length],
  };
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
