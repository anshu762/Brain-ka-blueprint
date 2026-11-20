# Brain ka Blueprint — reconstructed website

This project was rebuilt from the 43-page PDF supplied for this task.

## Run the website
1. Extract the ZIP.
2. Keep the `assets` folder beside `index.html`.
3. Open `index.html` in a modern browser, or serve the folder with a local web server.

## What works
- Original page sections, styling, navigation and interactions recovered from the PDF.
- Daily fact display, shuffle and unlock streak.
- Myth cards, daily swipe deck and all-myth list.
- Twelve puzzle interactions.
- Study category filters.
- News cards (the PDF contains a fixed list, not a live news feed).
- Nuro mascot, confetti and copy-handle action.
- Offline psychology helper based on the facts, myths and studies included in this website.
- Original Claude-hosted AI integration is retained when `window.claude.use` is available.

## What is still missing / needs your input
1. **Five original photographs:** the PDF contains shortened image data (`data:image/jpeg;base64,…`), not the actual photos. The website uses a clearly labelled neutral placeholder. Replace the five placeholder image references with the real images when you have them. The original photos cannot be recovered from this PDF.
2. **Full open-ended AI chat:** the original code uses `window.claude.use("sample")`, which is available only in a compatible Claude-hosted environment. In a normal browser, the helper now gives local answers from the website's own content. For real open-ended AI chat, connect a secure backend/API. Do not put a private API key in front-end JavaScript.
3. **Live news updates:** the PDF contains a hard-coded list of news items. It does not include an API or content-management system. The news section displays that fixed list until someone updates the source code or connects a news service.
4. **Deployment configuration:** the PDF does not include hosting, build, server, domain, or environment configuration. This is a static HTML website and can be hosted as a static site.

## Important notes
- The PDF export omitted the original HTML document wrapper and wrapped some lines. The document shell was restored and the recovered code was checked.
- The exact original look cannot be fully restored until the five original photos are supplied.
- The offline helper is a small local content search, not a generative AI model. Its answers are limited to content already included in the page.
- External Google Fonts and Instagram links need an internet connection.
