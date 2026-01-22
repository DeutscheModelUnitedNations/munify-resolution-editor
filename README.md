# @deutschemodelunitednations/munify-resolution-editor

A Svelte 5 component library for creating and editing UN-style resolutions. Built for Model United Nations conferences.

## Features

- **Full Resolution Editor**: Complete editing experience for UN resolutions with preamble and operative clauses
- **Block-based Structure**: Support for nested subclauses up to 4 levels deep
- **Phrase Validation**: Validate clause openings against official UN resolution vocabulary
- **Phrase Suggestions**: Inline autocomplete for common resolution phrases
- **Import from Text**: Parse plain text or LLM-formatted resolutions
- **Preview Mode**: Render resolutions in official UN document format
- **Fully Customizable**: i18n support, custom phrases, and snippet-based extension points
- **Type-safe**: Full TypeScript support with Zod schema validation

## Installation

```bash
# Using bun
bun add -d @deutschemodelunitednations/munify-resolution-editor

# Using npm
npm install -D @deutschemodelunitednations/munify-resolution-editor

# Using pnpm
pnpm add -D @deutschemodelunitednations/munify-resolution-editor
```

> **Note**: Svelte component libraries should be installed as `devDependencies` (`-d` / `-D` flag). SvelteKit bundles components at build time, so they don't need to be runtime dependencies.

## Peer Dependencies

This library requires:

- `svelte` ^5.0.0
- TailwindCSS and DaisyUI configured in your project (for styling)

## Styling Setup

This library uses TailwindCSS utility classes for styling. Since the components are distributed as Svelte files, you need to configure your project's Tailwind to scan the library's components.

### Tailwind CSS v4

Add a `@source` directive to your main CSS file (e.g., `app.css`) to include this library's components in the Tailwind scan:

```css
@import 'tailwindcss';

/* Include resolution-editor library components in Tailwind scan */
@source "../node_modules/@deutschemodelunitednations/munify-resolution-editor/dist/**/*.svelte";

@plugin "daisyui";
```

### Tailwind CSS v3

Add the library to your `content` array in `tailwind.config.js`:

```javascript
export default {
 content: [
  './src/**/*.{html,js,svelte,ts}',
  './node_modules/@deutschemodelunitednations/munify-resolution-editor/dist/**/*.svelte'
 ]
 // ... rest of config
};
```

### Using `bun link` for Development

If you're using `bun link` for local development, the symlink will still point to `node_modules`, so the paths above will work correctly.

## Usage

### Basic Editor

```svelte
<script lang="ts">
 import { ResolutionEditor } from '@deutschemodelunitednations/munify-resolution-editor';
 import {
  germanPreamblePhrases,
  germanOperativePhrases
 } from '@deutschemodelunitednations/munify-resolution-editor/phrases/de';
 import { germanLabels } from '@deutschemodelunitednations/munify-resolution-editor/i18n/de';
 import type { Resolution } from '@deutschemodelunitednations/munify-resolution-editor/schema';

 let resolution: Resolution = $state({
  committeeName: 'General Assembly',
  preamble: [],
  operative: []
 });

 function handleChange(updated: Resolution) {
  resolution = updated;
  console.log('Resolution updated:', updated);
 }
</script>

<ResolutionEditor
 committeeName="General Assembly"
 {resolution}
 editable={true}
 labels={germanLabels}
 preamblePhrases={germanPreamblePhrases}
 operativePhrases={germanOperativePhrases}
 onResolutionChange={handleChange}
/>
```

### Preview Only

```svelte
<script lang="ts">
 import { ResolutionPreview } from '@deutschemodelunitednations/munify-resolution-editor';
 import { germanLabels } from '@deutschemodelunitednations/munify-resolution-editor/i18n/de';
</script>

<ResolutionPreview
 {resolution}
 labels={germanLabels}
 headerData={{
  conferenceName: 'Model United Nations',
  committeeName: 'Security Council',
  topic: 'International Peace and Security',
  documentNumber: 'S/RES/2026/1'
 }}
/>
```

## Exports

### Main Components

```typescript
import {
 ResolutionEditor, // Full editing interface
 ResolutionPreview, // Read-only preview
 ClauseEditor, // Preamble clause editor
 OperativeClauseEditor, // Operative clause editor
 SubClauseEditor, // Recursive subclause editor
 PhraseLookupModal, // Phrase browsing modal
 PhraseSuggestions, // Inline autocomplete
 ImportModal // Text import modal
} from '@deutschemodelunitednations/munify-resolution-editor';
```

### Schema & Types

```typescript
import {
 type Resolution,
 type PreambleClause,
 type OperativeClause,
 type SubClause,
 type ClauseBlock,
 type TextBlock,
 type SubclausesBlock,
 type ResolutionHeaderData,
 resolutionSchema,
 createEmptyOperativeClause,
 createEmptySubClause,
 createTextBlock,
 createSubclausesBlock,
 getSubClauseLabel
} from '@deutschemodelunitednations/munify-resolution-editor/schema';
```

### Phrases

```typescript
// All German phrases
import {
 germanPreamblePhrases,
 germanOperativePhrases
} from '@deutschemodelunitednations/munify-resolution-editor/phrases/de';

// Or import individually
import { preamblePhrases } from '@deutschemodelunitednations/munify-resolution-editor/phrases/de';
import { operativePhrases } from '@deutschemodelunitednations/munify-resolution-editor/phrases/de';
```

### Internationalization

```typescript
import type { ResolutionEditorLabels } from '@deutschemodelunitednations/munify-resolution-editor/i18n';
import { germanLabels } from '@deutschemodelunitednations/munify-resolution-editor/i18n/de';
```

## Extension Points

The editor supports Svelte 5 snippet-based extension points for customization:

```svelte
<ResolutionEditor {...props}>
 {#snippet clauseToolbar({ clause, index })}
  <button onclick={() => addAmendment(clause)}>Add Amendment</button>
 {/snippet}

 {#snippet clauseAnnotations({ clause, index })}
  {#if hasAmendments(clause)}
   <div class="badge badge-warning">Has amendments</div>
  {/if}
 {/snippet}

 {#snippet previewHeader({ resolution, headerData })}
  <div class="custom-header">Custom header content</div>
 {/snippet}

 {#snippet previewFooter({ resolution })}
  <div class="signatures">Signatures section</div>
 {/snippet}
</ResolutionEditor>
```

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build library
bun run package

# Type checking
bun run check

# Run tests
bun test
```

## License

MIT - Deutsche Model United Nations e.V.
