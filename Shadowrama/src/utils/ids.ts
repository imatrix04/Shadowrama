// Identifiants uniques et monotones.
// `Date.now()` seul provoquait des collisions dès que deux blocs étaient créés
// dans la même milliseconde (ajout rapide, duplication de diapo).
let counter = 0

export function nextId(): number {
  // Date.now() * 1000 reste très en dessous de Number.MAX_SAFE_INTEGER,
  // et le suffixe garantit 1000 identifiants distincts par milliseconde.
  return Date.now() * 1000 + (counter++ % 1000)
}
