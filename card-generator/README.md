# Spell Card Press

Serve the repository with a local web server and open `card-generator/`.
For example, run `python -m http.server 8000` from the repository root and open
<http://localhost:8000/card-generator/>.

## Printing

Select spells, choose a card size, and choose **Card backs**:

- **Fronts only** preserves the original layout: 16 half-size or 9 standard cards
  per A4 page.
- **Fold and glue** places each front immediately beside its corresponding back,
  with a dashed fold seam and no gap between them. Cut around the whole pair,
  fold on the seam, and glue. Print single-sided. Each page fits 8 half-size or
  3 standard pairs.
- **Double-sided** alternates a front page with its matching back page. Back
  columns are reversed, including empty positions on partial pages. Print
  duplex with **flip on long edge**. Each sheet fits 16 half-size or 9 standard
  cards. Continuation cards receive their own corresponding backs.

Use **A4 portrait**, **100% / actual size**, background graphics enabled,
and browser headers/footers disabled. Do not use fit-to-page or multiple pages
per sheet. Test one sheet before a large duplex run: printer feed tolerances
can affect physical alignment.

Back previews appear after their fronts in the selection panel when either
back option is enabled. Keyword icons replace their redundant damage-type,
condition, and melee/ranged attack names; dice, durations, and save abilities
remain visible. Full keyword labels are retained for assistive technology.
Back designs use the supplied parchment, range emblems,
keyword icons, and matching area diagrams. Missing area diagrams are generated
as inline SVG for cones, cubes, cylinders, emanations, spheres, squares, and
lines. Generated grids include their scale; large areas use larger grid squares.
Sphere and cylinder sizes represent radii, cube/square sizes represent side
lengths, and line dimensions show length and width when available.
Some SRD spells lack area metadata; an area explicitly described in their opening
sentence is also recognized. Custom cards can specify their shape and size in
the editor. Target counts use explicit "up to" counts when present, otherwise the
spell's target-count metadata (or Self for self-range spells).

## Tests

Run `node --test card-generator\app.test.cjs` from the repository root.
The tests use Node's built-in test runner and require no dependencies.
