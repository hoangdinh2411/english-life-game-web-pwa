# Player gender onboarding design

## Scope

Extend `/new-game` into three consecutive internal steps: country selection,
character selection, then name entry. Character selection stores one required
gender value (`female` or `male`) during first-run creation. Gender is persisted
by the server and cannot be changed after onboarding.

This slice does not add hair, shirt, or trouser color controls. Future appearance
changes belong to hair-salon or clothing-store gameplay and must not be exposed
as direct profile editing.

## Assets and presentation

- Provide dedicated female and male player walking sheets with identical
  `128×192` geometry, a 4×4 grid of `32×48` frames, matching visible scale,
  direction order, animation timing and baseline. Do not reuse an NPC sheet.
- Provide a matching dedicated portrait for each player character.
- The character step displays two image-only choice buttons. Visible `Female`
  and `Male` labels are intentionally omitted; each button still has an
  accessible name for screen readers. Neither choice is preselected.
- The selected asset is used by every saved-game player render and player
  portrait. Local practice keeps its current generic practice character.
- Existing appearance recoloring remains unchanged and is not exposed by this
  onboarding slice.

## Contracts and persistence

- Add a shared `PlayerGender` union containing only `female` and `male`.
- Extend the create-character request with required `gender` and reject missing,
  unknown, or additional values at the shared validation boundary.
- Add a forward migration that stores a non-null, check-constrained gender on
  `characters`. Existing characters receive a deterministic compatibility value
  before the non-null constraint is enabled.
- The server remains authoritative: it accepts only the gender identifier, maps
  it to approved assets, and writes gender in the existing first-run transaction.
- Same-payload onboarding replay includes gender. A replay that changes gender
  conflicts like any other changed first-run payload.
- Return gender in the saved character response. Do not add a profile or life
  endpoint that updates gender.

## Client flow

The form uses one `/new-game` route and three internal steps:

1. Search for and select a country, then continue.
2. Choose one of two character images, then continue.
3. Enter a valid name and create the character.

Back is available on steps two and three and preserves every earlier choice.
Forward navigation is disabled until the current step is valid. Recoverable
submission errors preserve all three choices and remain on the name step.

The form must retain its current keyboard and screen-reader behavior, 44-pixel
minimum touch targets, and compact scrolling at 320, 375, and desktop widths.

## Failure handling

- Missing or invalid gender is a client validation failure and a server 400.
- A configured gender whose asset cannot load shows a readable choice label;
  character creation remains blocked from shipping unless asset verification
  passes.
- A database failure rolls back character, initial life state, and starting
  grants together.

## Verification

- Shared parser tests cover both values and reject missing/unknown values.
- Server unit and integration tests cover persistence, response shape,
  idempotent replay, changed-gender conflict, and transaction rollback.
- Client tests cover step order, per-step validation, Back preservation,
  preservation on retry, hidden visual gender text, accessible image choices,
  and gender-to-asset resolution.
- Asset tests verify both sheets and portraits exist and match their expected
  geometry.
- Browser verification covers mouse/touch and keyboard selection, no horizontal
  overflow, reachable Continue, and readable previews at 320, 375, and at least
  1024 CSS pixels.

## Deferred work

Add a separate future task for initial color customization and later appearance
changes through clothing-store and hair-salon NPC flows. Gender remains immutable.
