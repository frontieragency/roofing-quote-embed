# Roofing instant-quote — embeddable demo

Standalone instant-quote generator for **North Star Roofing & Restoration** (Texas / North Dallas),
built to be dropped into any site via `<iframe>`.

```html
<iframe src="https://frontieragency.github.io/roofing-quote-embed/"
        width="100%" height="720" style="border:0;width:100%"
        title="Instant Roofing Quote" loading="lazy"></iframe>
```

**Demo mode:** the lead form shows success but sends nothing (`demo: true` in the source config).
Pricing is **example North-Texas pricing only** — replace with the real price sheet and remove
demo mode before quoting customers.

Generated from `glass-site-template` (`config/north-star-roofing.json` → `templates/roof`).
