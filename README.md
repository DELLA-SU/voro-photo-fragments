# 바사삭!

An interactive Canvas rendering of the supplied photograph using actual Voronoi cells computed with https://github.com/chr1shr/voro.

The C++ library runs at asset generation time. All seeds lie on z=0 in a thin 3D container; the lower face of each resulting prism supplies its planar polygon. Eight tessellations have 10, 20, 50, 100, 400, 1600, 6400, and 14400 seeds. Each cell clips the actual photograph texture, avoiding color-averaging mosaic artifacts. At zero separation in the front view, the exact photo is rendered.

The default renderer is real WebGL 3D: Voro++ polygons are intersected with the photograph's alpha silhouette, extruded into solid prisms, and textured on the front. The pieces rotate on three axes and move in depth, with lit cut surfaces and a perspective camera. Dragging rotates the view. Vertex attributes animate all cells in a single merged mesh draw call. This creates a photo-textured relief; it does not infer the unseen back of the pictured object. A Canvas 2D fragment fallback is used if WebGL cannot initialize. Manual separation, assembly, looping playback, boundaries, original comparison, and PNG export are included.

Visitors can select a local image up to 20MB; it is decoded, contained to the stage without stretching, and clipped to the same Voro++ cells entirely in the browser. Uploaded files are never sent to the server and last for the current page session. Only the default cat has its connected white background removed for fragment rendering; uploaded images retain their own background and transparency. The original cat can be restored. Coarse counts retain all cells; high counts omit empty background fragments and show the visible count separately from the total seed count.

To regenerate, compile vendor/voro/voro++.cc with scripts/cells.cpp (include vendor/voro), producing scripts/cells; then run scripts/generate.py with Python and Pillow. Serve dist with any static web server.

Voro++ copyright and license: dist/VORO-LICENSE.txt. Vendored source is from the user's linked repository.

Bundled browser libraries: Three.js 0.180.0 (dist/vendor/THREE-LICENSE.txt) and polygon-clipping 0.15.7 (dist/vendor/POLYGON-CLIPPING-LICENSE.txt). No runtime CDN or image upload service is required.

## Live website

https://della-su.github.io/voro-photo-fragments/

GitHub Actions deploys the static dist/ directory to GitHub Pages after each push to main. Images selected by visitors stay in their browser and disappear when the page is reloaded.

## Wave mode (QMsolve)

`파동 모드` toggles a continuously evolving 2D quantum harmonic-oscillator superposition. The playback button pauses/resumes the wave; original comparison pauses rendering and returning resumes it. Separation, density, boundaries, rotation and PNG export continue to work. The mode starts off; reduced-motion visitors see a static field until explicitly playing. WebGL is required for this mode.

Generate `dist/wave-basis.png` and `dist/wave-model.json` with `scripts/generate_wave.py` using dependencies in `scripts/wave-requirements.txt`. QMsolve 2.0.0 solves the lowest three eigenstates on a 96×96 grid, in a 2D anisotropic harmonic potential. RGB stores the individually scaled real eigenfunctions. The browser uses the computed relative energies to evolve their normalized superposition, then maps its real part into each fragment's depth and finite spatial differences into tilt. Subtracting the ground energy removes a common phase. Playback time is slowed for viewing. This is an artistic depiction of a computed wavefunction, not quantum/classical mechanics of solid photo fragments. The browser shader uses one shared field sample per cell, so each Voronoi piece remains rigid.

QMsolve: https://github.com/quantum-visualizations/qmsolve (BSD-3-Clause; license in `dist/QMSOLVE-LICENSE.txt`). No Python server is required at runtime.
