# Elementary-Constellations
## Cut outline (acrylic template)

The blue border in the draw/preview views (and the cut line in the exported SVG) is the cut
outline. There are two ways to change it:

**For everyone (default outline):** regenerate `src/boxOutline.js` from a template and commit it.

```sh
npm run outline -- acrylic_template.svg              # or a .dxf file
npm run outline -- new_template.dxf --units mm       # if the DXF has no $INSUNITS
```

**On one device only (no repo change):** click **Outline settings** below the canvas, load an
SVG or DXF, check the preview and warnings, then click **Use this outline**. It is saved in that
browser's local storage. A yellow banner shows while a custom outline is active; click
**Reset to default** in the banner (or the settings window) to go back to the built-in outline.

Either way, the outline is converted to inches and centered in the 7.3 × 5 in canvas, using the
same parser (`src/outline.js`). Supported geometry is lines, polylines and arcs; curves
(splines/Béziers) are not.
