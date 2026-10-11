# Cursor color shift

Shifts page colors based on where the cursor is horizontally.

- **Left edge:** the section's default colors, exactly as they are now.
- **Right edge:** the dominant color of the image that is most visible on screen. A mostly green image gives green.
- **In between:** a smooth blend of the two.

## Contrast

Only hue and saturation change. Each color keeps its lightness, so a dark section stays dark and grey text keeps its brightness (it becomes a tinted grey). Every frame checks the WCAG contrast ratio between background and text. If the ratio would fall below the section's default, the script moves the text color away from the background until the default ratio is met again.

Measured in the demo:

| Section | Left (default) | Right |
|---|---|---|
| Off-white / grey text | 4.72 | 4.89 |
| Dark / light text | 13.64 | 13.98 |
| Light grey / dark text | 11.33 | 11.40 |

## Setup

```html
<section data-bg="#f4f1ea" data-fg="#6b6b6b">
  ...
  <img src="project.jpg">
</section>

<script src="cursor-color.js"></script>
```

- `data-bg` / `data-fg`: the section's default (left side) colors. If you leave them out, the script reads the section's computed colors.
- `data-accent`: a fixed right-side color for sections without images.
- Remove the old scroll-based color script. This script replaces it: the section in the middle of the viewport still sets the default colors, so colors still change as you scroll.

Optional settings, defined before the script loads:

```html
<script>
  window.CursorColorConfig = {
    sections: '[data-bg], section', // elements that define color sections
    target: document.body,          // element whose background/color is set
    strength: 1,                    // 0..1, how far the right edge goes
    maxBgChroma: 0.04,              // background tint strength (raise for bolder)
    textChroma: 0.35,               // text tint relative to the image color
    smoothing: 0.14                 // 0..1 per frame, 1 = instant
  };
</script>
```

The current colors are also exposed as CSS variables (`--cc-bg`, `--cc-fg`, `--cc-accent`), so headings, links or borders that set their own color can use them too, e.g. `h1 { color: var(--cc-fg); }`.

## Notes

- **Images on another domain** (CDN, Squarespace/Webflow asset hosts) must be served with CORS headers and given `crossorigin="anonymous"`, or the browser blocks reading their pixels. Images that can't be read are skipped. Use `data-accent` as a fallback.
- **Touch devices** have no cursor, so they keep the default colors.
- **Reduced motion:** with `prefers-reduced-motion`, colors change without animated easing.
- **Content loaded later** (e.g. page transitions): call `CursorColor.refresh()`.

## Demo

Serve the folder (`npx serve cursor-color`) and open `/demo/`.
