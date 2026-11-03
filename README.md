# Sample property survey

A sample commercial real estate property survey, rebuilt from a listings file whenever the budget changes: shortlist, comparison matrix, one page per space, and a US Letter PDF.

Live page: https://theaipipe.com/demos/property-survey-sample/

**Everything in the data is fictional**: buildings ("Example Building A"), suites, listing brokers, rents, dates. The submarket names (Southwest, Airport, North Las Vegas, Henderson) are real Las Vegas submarkets; the map is a schematic and pin positions are illustrative.

## What it does

- Reads `site/sample-listings.csv`: 16 rows in an assumed column layout.
- Applies one example requirement: 8,000 to 12,000 SF in one space, Southwest submarket, at least one dock-high and one grade-level door, available by March 1, 2027, warehouse and light assembly use, and a maximum monthly budget (estimated base rent + stated expenses).
- Groups rows into offers. An exact repeat is counted once. The same suite offered on other terms (here, storage only) stays a separate offer. Two rows quoting different rents for the same offer stay together and are flagged; the newer figure is not assumed to be right.
- Gives each offer one of three results, with its reason: **Meets**, **To confirm** (an essential value is missing or contradictory; it stays there whatever the budget), **Excluded**.
- Costs: SF x base rent ($/SF/mo, NNN) + SF x stated expenses ($/SF/mo), then x 12 at the initial rate. An annual quote is converted only when the listing states the period. "On request" never becomes $0. A blank door count is neither present nor absent. Two suites of 5,000 SF are not added together.
- Ranks the spaces that meet every requirement by estimated monthly cost. No score.
- Lays out the survey: page 1 the requirement, the result and a schematic map; page 2 the comparison matrix in landscape, with the spaces to confirm and the exclusions; then one page per ranked space with a schematic bay plan drawn from the listing fields.

Every sentence in the survey is assembled by rules from the current values. No AI model runs on the page.

## Files

- `site/rules.js`: parsing, grouping, checks, costs, ranking, sentences (pure functions; also loads in Node).
- `site/app.js`: renders the pages, the budget scale and the review table from the rules.
- `site/styles.css`: screen and print styles; the same pages are shown on screen and printed.
- `site/pdf/`: the survey printed for every $500 budget step, by `scripts/render_pdfs.py`.
- `worker.js`, `wrangler.toml`: static hosting on Cloudflare.

## Run locally

```
python3 -m http.server --bind 127.0.0.1 8781 --directory site
# then, to reprint the PDFs (needs Playwright with Chromium):
python scripts/render_pdfs.py http://127.0.0.1:8781/
```

## Limits of this sample

- Sample data only. Nothing connects to a listings database, and the column layout is assumed, not matched to any particular export.
- One fixed requirement. A real version would take the requirement, the selection rules and the layout from the broker's own guidelines and example surveys.
- No photos; the plans are schematic and not to scale.
- Zoning is shown as listed; whether the tenant's use is permitted is not checked. Availability is as of the source date.
- Costs leave out whatever the listing does not state (utilities, improvements, escalations).

By Frederic de Lavenne de Choulot, The AI Pipe. https://cal.theaipipe.com
