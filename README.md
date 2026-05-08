# ANIARTX Gallery

Static ART IP gallery for GitHub Pages. The public site is served from the repository root and uses the custom domain `aniartx.com`.

## Local Admin

Run the local admin server when you need to add, delete, and publish artwork:

```bash
node scripts/admin-server.mjs
```

Then open:

```text
http://localhost:8093/admin.html
```

The admin can:

- add new images to an IP/category
- convert uploads to web-friendly WebP
- delete existing artworks
- update `data/art-gallery.json`
- commit and push the changes to GitHub

GitHub Pages is static, so the admin is intentionally local-only. After you click `Publish to GitHub`, the live site updates through GitHub Pages.
