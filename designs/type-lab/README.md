# Type lab (2026-11-12)

Mockups for replacing the animated figures in the Dossier hero with generated typography.
Not wired into the site yet.

Published pages (private, claude.ai):
- orbit-type.html       → https://claude.ai/artifact/4vKVix76JFRbiAohD7HvF6  (current shortlist: 9A 9B 9C 8A 8B 8C 7C)
- type-lab.html         → https://claude.ai/artifact/4GFHaSqnNhpocYtWHpPP7Q  (one treatment per ref in Site work/topography)
- collage-variations    → https://claude.ai/artifact/2nMKoiHrArn772QFQmoMxQ
- type-portraits.html   → https://claude.ai/artifact/DxE13VnbyN3V3JrPJCXYn2
- figure-staging.html   → https://claude.ai/artifact/3QWXzpzDF2Exzx2X3Dr9Yk  (figures; Universe still test = universe-still.js)

Rebuild: each build-*.py stitches a shell page + *-variants.js + *-opts.js. Run them from this folder.
Chain: type-portraits.html → type-lab.html (build-typo.py) → orbit-type.html (build-orbit.py).
The scripts also write prev/*-local.html previews; make a prev/ folder first.
