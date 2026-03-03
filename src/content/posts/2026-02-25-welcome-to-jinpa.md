---
title: "Welcome to Jinpa"
date: 2026-02-25
description: "Your new blog is ready. Jinpa gives you a beautiful, fast, and fully static site powered by Astro."
author: "Jinpa Team"
tags: ["jinpa", "astro", "getting-started"]
categories: ["announcements"]
---

Welcome to your new Jinpa blog! This is your first post, and it is here to show you what is possible.

## What is Jinpa?

Jinpa is an opinionated static blog platform built on top of [Astro](https://astro.build). It follows a convention-over-configuration philosophy, which means you spend less time setting things up and more time writing.

Here is what you get out of the box:

- **Zero JavaScript by default** - Your site ships pure HTML and CSS until you opt into interactivity
- **Dark mode** - Toggle between light and dark themes with a single click
- **Full-text search** - Powered by Pagefind, search works entirely client-side with no server needed
- **SEO optimized** - Open Graph tags, structured data, sitemaps, and RSS feeds are all built in
- **View transitions** - Smooth page-to-page navigation with the Astro Client Router
- **Mobile responsive** - Looks great on every screen size

## Writing Posts

Create a new Markdown file in `src/content/posts/` with frontmatter like this:

```yaml
---
title: "My New Post"
date: 2026-02-25
description: "A brief description of the post"
tags: ["tag1", "tag2"]
---
```

Then write your content in Markdown below the frontmatter. Jinpa handles the rest.

## Customizing Your Site

### Site Configuration

Edit `site.config.json` to set your site title, description, author info, navigation, and social links.

### Theme Configuration

Edit `theme.config.json` to customize colors, fonts, spacing, and feature toggles. Enable or disable dark mode, search, RSS, and more.

### Styling

The global stylesheet lives at `src/styles/global.css`. It uses CSS custom properties that map to your theme configuration, making it easy to adjust the look and feel.

## What is Next?

1. Edit `site.config.json` with your own information
2. Replace this post with your own content
3. Customize the theme in `theme.config.json`
4. Deploy to GitHub Pages with a single push

Happy writing!
