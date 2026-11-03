"""Print the survey to PDF for every budget step, from the same page the browser shows.

Usage: python scripts/render_pdfs.py http://127.0.0.1:8781/
(serve site/ first, e.g. python3 -m http.server --bind 127.0.0.1 8781 --directory site)
Writes site/pdf/sample-survey-<budget>.pdf. Needs Playwright with Chromium.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8781/'
OUT = Path(__file__).resolve().parent.parent / 'site' / 'pdf'
OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function('document.documentElement.dataset.ready === "1"')
    page.evaluate('document.fonts.ready')
    lo, hi, step = page.evaluate('[SurveyRules.BUDGET.min, SurveyRules.BUDGET.max, SurveyRules.BUDGET.step]')
    for budget in range(lo, hi + 1, step):
        page.evaluate(f'setBudget({budget})')
        pages = page.evaluate('SurveyState().pages')
        path = OUT / f'sample-survey-{budget}.pdf'
        page.pdf(path=str(path), prefer_css_page_size=True, print_background=True)
        print(budget, pages, path.name)
    browser.close()
