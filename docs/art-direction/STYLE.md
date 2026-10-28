Look at these reference images from my game. Describe the art style objectively:
camera angle, outline style, shading, color palette (give hex codes), lighting
direction, level of detail, proportions. Do not invent anything that is not
visible in the images. Output as a short STYLE.md.

## Asset naming

Use two names for every generated asset:

- The editable source/AI output uses `[Prefix]_[Object]_[StateOrVariant]` in
  PascalCase, for example `T_Player_BaseColor`, `SFX_Button_Click`, or
  `Anim_Player_Walk`. Do not use spaces, Vietnamese diacritics, or ambiguous
  names such as `final`, `new`, or `copy`.
- The published runtime key is a lowercase, API-safe equivalent, for example
  `t_player_base_color` or `anim_player_walk`. Storage adds the immutable
  version and SHA-256 suffix: `v2-<sha256>.png`.

Prefixes: `T_` for textures, `M_` for materials, `S_` or `SFX_` for audio,
`A_` or `Anim_` for animation data, and `P_` or `Prefab_` for prefabs. Map and
item names must include their destination or owning object when needed to avoid
collisions.

AI-generated static files are reviewed locally under `local-assets/maps/`
before publishing. Runtime-generated speech is uploaded by the backend to its
private speech bucket; it is not committed or published by the static asset
sync script.
