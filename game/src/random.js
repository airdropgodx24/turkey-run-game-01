// Seeded randomness: one mulberry32 generator drives every spawn and wobble, so a given
// seed always lays out the same run. The screenshot scenes lean on that to be reproducible.

/** Make a mulberry32 generator from a 32-bit seed. Returns a function yielding floats in [0, 1). */
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float between min and max from the generator. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** An integer between min and max, both ends included. */
export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One item of the list, chosen by the generator. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** True with the given probability (0..1). */
export function chance(rng, probability) {
  return rng() < probability;
}

/** A shuffled copy of the list (the original is left alone). */
export function shuffled(rng, list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
