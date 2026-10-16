# Prompt: Recreate the Paladin Board as HTML

Use `dnd-hotb-paladin-class-board-lvl1.tif` in this workspace as the single source of truth. Inspect the image itself and recreate it as an HTML template that matches it as closely as possible.

## Exact page requirements

- The finished page must be **A4 landscape: exactly 297 × 210 mm**. Set the print page to A4 landscape with zero page margins, and make the page canvas exactly those dimensions.
- The source image is 3301 × 2551 pixels, which has a different aspect ratio from A4 landscape. Preserve the complete board, scale it uniformly to fit within the A4 page, and center it. Do not crop, rotate, stretch, or distort it; any unused space should remain as a clean page margin around the board.
- The browser may scale the page proportionally to fit a smaller preview area, but its underlying print dimensions must remain A4 landscape. Never reflow or rearrange the board's contents.
- Keep the board's exact composition: positions, proportions, spacing, borders, colors, typography, line breaks, labels, text, icons, and decorative details. Do not redesign, modernize, simplify, or invent elements.

## Implementation requirements

- Build the board with semantic HTML and CSS so its sections and text remain selectable and maintainable. Do not use the entire TIFF as a page background or place it as a single full-board image; that would only display the reference rather than create an HTML template.
- Put the markup in `paladin-level-1-board.html` and all styling in a separate `paladin-level-1-board.css` file. Link the stylesheet from the HTML using a relative path. Do not use a `<style>` block, inline `style` attributes, or CSS-in-JS.
- Format both files for easy human editing: use consistent indentation, meaningful whitespace, descriptive class names, and readable line lengths. Keep the HTML organized into clearly identifiable semantic sections. Organize CSS into logical sections with concise headings where useful; avoid minified CSS and overly dense selectors.
- Use the TIFF as a visual tracing/reference layer while matching it. If a small, complex decorative graphic cannot reasonably be recreated in CSS or HTML, preserve that specific detail as a separate cropped image asset; do not rasterize the whole board.
- Preserve all visible wording and punctuation exactly as shown, including capitalization and line breaks where they affect the layout. Do not add content that is not visible in the source.
- Use local assets only. Do not fetch external images, fonts, libraries, or other resources.
- Make the result usable as a local HTML template with its separate stylesheet and any required local image assets. Avoid unnecessary JavaScript and external dependencies.
- Do not add responsive layout changes that alter the board. A smaller-screen preview may use uniform scaling only.

## Verification

- Render the finished page at the exact A4 landscape size and compare the board artwork against the TIFF.
- Check the outer bounds and alignment first, then compare each panel, text block, border, color, and small detail. Correct visible mismatches before finishing.
- Confirm that the printed page is exactly 297 × 210 mm, the complete board is centered and uniformly scaled, and no content is clipped or overflows its intended area.

Deliver `paladin-level-1-board.html`, `paladin-level-1-board.css`, and any required local assets. Briefly report the output file names and confirm the A4 landscape page dimensions.