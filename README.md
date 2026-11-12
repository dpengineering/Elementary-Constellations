# Elementary-Constellations
## Cut outline (acrylic template)

The blue border in the draw/preview views (and the cut line in the exported SVG) comes from
`src/boxOutline.js`, which is generated from a template file. To change it, run:

```sh
python3 scripts/outline_to_path.py acrylic_template.svg      # or a .dxf file
python3 scripts/outline_to_path.py new_template.dxf --units mm  # if the DXF has no $INSUNITS
```

The outline is converted to inches and centered in the 7.3 × 5 in canvas. Supported geometry is
lines, polylines and arcs; curves (splines/Béziers) are not.
