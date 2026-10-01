<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Writing style

Before writing any prose for this repo — commit messages, PR descriptions, docs, comments, issue text — read `deslopify.md` (same directory as this file) and avoid the patterns it lists.

# Component styling

Use `src/app/design-system.css` for all visual styles. Change its root tokens for palette, typography, spacing, radii, shadows, and motion updates. Reuse `ui-button`, `ui-button-secondary`, `ui-input`, `ui-card`, and `ui-badge` for new components. Add component styles to that same file using existing tokens. Keep inline styles limited to data-dependent layout, such as periodic-table grid positions. Keep chemical formulas in the body font. Do not load the reference site's trial fonts; use licensed font assets when available.
