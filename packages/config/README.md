# @ai-workspace-lab/config

Shared engineering presets for every workspace package.

## Exports

- `@ai-workspace-lab/config/tsconfig.base.json` — strict TS base (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.)

> Lint + format are no longer in this package. They live in the root [`biome.json`](../../biome.json)
> — Biome runs at the repo root in a single pass. See [journal 0002](../../docs/journal/0002-tooling-switch-to-biome-and-playwright.md).

## Usage in another package

`tsconfig.json`:

```json
{
  "extends": "@ai-workspace-lab/config/tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"]
}
```
