from playwright.sync_api import sync_playwright

URL = "file:///C:/Users/edwinisaace/OneDrive%20-%20Microsoft/Documents/GitHub/edwinestro.github.io/legacy/stringball-endpoint/maze.html#autostart"
OUT_PATH = "Projects/hubs/science-lab/assets/attract-ion-1600x900.png"


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 900})
        page.goto(URL, wait_until="load", timeout=20000)
        page.wait_for_timeout(2500)
        page.screenshot(path=OUT_PATH, full_page=False)
        browser.close()


if __name__ == "__main__":
    main()
