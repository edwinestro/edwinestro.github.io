from playwright.sync_api import sync_playwright
import time

URL = "file:///C:/Users/edwinisaace/OneDrive%20-%20Microsoft/Documents/GitHub/edwinestro.github.io/Projects/games/attract-ion/index.html"
OUT_DIR = "Projects/hubs/science-lab/assets/attract-ion_frames"


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 900})
        page.goto(URL, wait_until="load", timeout=20000)
        page.wait_for_timeout(1000)
        for i in range(0, 36):
            page.screenshot(path=f"{OUT_DIR}/frame_{i:03d}.png", full_page=False)
            page.wait_for_timeout(120)
        browser.close()


if __name__ == "__main__":
    main()
