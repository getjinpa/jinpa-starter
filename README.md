# Jinpa Starter Blog

A clean, fast blog template — part of the [Jinpa](https://jinpa.dev) platform. Deploy to GitHub Pages in minutes, manage content with the built-in admin panel.

## What you get

- Fast static blog powered by [Astro](https://astro.build)
- Built-in admin panel at `/admin/` — no separate service needed
- Write and publish posts without touching code
- Automatic deployment to GitHub Pages via GitHub Actions
- Dark mode, RSS feed, sitemap included

## Deploy this template

**The easy way** — use [jinpa.dev](https://jinpa.dev) to set everything up in a few clicks.

**The manual way:**

1. Click **Use this template** → **Create a new repository**
2. Go to your new repo → **Settings** → **Pages** → set Source to **GitHub Actions**
3. Push any change to `main` to trigger your first deploy
4. Your site will be live at `https://username.github.io/repo-name/`

## Manage your content

Once deployed, go to `https://username.github.io/repo-name/admin/` and set up your admin panel with a GitHub Personal Access Token (`repo` + `workflow` scopes).

From there you can:
- Write and publish posts
- Edit pages
- Upload images
- Change site settings and theme

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:4321` in your browser.

## Configuration

- **Site settings** — edit `site.config.json`
- **Theme / colors** — edit `theme.config.json`
- **Content** — `src/content/posts/` and `src/content/pages/`

## License

MIT
