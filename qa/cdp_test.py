import base64
import json
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

import websocket


ROOT = Path(__file__).resolve().parents[1]
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
PORT = 9340
URL = "http://127.0.0.1:8040/"


with tempfile.TemporaryDirectory(prefix="api-course-chrome-") as profile:
    process = subprocess.Popen(
        [
            str(CHROME),
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            f"--remote-debugging-port={PORT}",
            "--remote-allow-origins=*",
            f"--user-data-dir={profile}",
            URL,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    def wait_for_page():
        for _ in range(80):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list") as response:
                    pages = json.load(response)
                page = next((item for item in pages if item.get("type") == "page"), None)
                if page:
                    return page
            except Exception:
                time.sleep(0.2)
        raise RuntimeError("Chrome DevTools did not start")

    try:
        page = wait_for_page()
        ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=15)
        counter = 0

        def command(method, params=None):
            nonlocal_counter = None
            global counter
            counter += 1
            request_id = counter
            ws.send(json.dumps({"id": request_id, "method": method, "params": params or {}}))
            while True:
                message = json.loads(ws.recv())
                if message.get("id") == request_id:
                    if "error" in message:
                        raise RuntimeError(message["error"])
                    return message.get("result", {})

        def evaluate(expression):
            result = command(
                "Runtime.evaluate",
                {"expression": expression, "returnByValue": True, "awaitPromise": True},
            )
            if result.get("exceptionDetails"):
                raise RuntimeError(result["exceptionDetails"])
            return result["result"].get("value")

        def screenshot(name):
            result = command("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
            (ROOT / "qa" / name).write_bytes(base64.b64decode(result["data"]))

        def wait_for_path(path):
            for _ in range(50):
                if evaluate("location.pathname") == path:
                    time.sleep(0.3)
                    return
                time.sleep(0.1)
            raise AssertionError(f"Navigation did not reach {path}")

        def header_state():
            return json.loads(evaluate("""JSON.stringify((() => {
              const heading = document.querySelector('.hero-title');
              const subtitle = document.querySelector('.hero-subtitle');
              return {
                selected: document.querySelector('.api-version-select').value,
                heading: heading.getAttribute('aria-label'),
                headingSize: getComputedStyle(heading).fontSize,
                headingLineHeight: getComputedStyle(heading).lineHeight,
                subtitle: subtitle.textContent.trim(),
                subtitleSize: getComputedStyle(subtitle).fontSize,
                mission: document.querySelector('.mission-label').textContent.trim(),
                completed: document.querySelector('#completedCount').textContent.trim(),
                overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
              };
            })())"""))

        command("Page.enable")
        command("Runtime.enable")
        command("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
        command("Page.reload", {"ignoreCache": True})
        time.sleep(0.8)

        landing = json.loads(evaluate("""JSON.stringify({
          title: document.title,
          cards: document.querySelectorAll('.api-card').length,
          selected: document.querySelector('input[name="api-version"]:checked').value,
          startText: startButton.textContent.replace(/\\s+/g, ' ').trim(),
          startHref: startButton.getAttribute('href'),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        })"""))
        assert landing == {
            "title": "Andmepädevus · API-praktikumid",
            "cards": 3,
            "selected": "api1",
            "startText": "Alusta API 1→",
            "startHref": "./api1/",
            "overflow": False,
        }, landing
        screenshot("launcher-desktop.png")

        evaluate("document.querySelector('input[value=\"api3\"]').click()")
        changed = json.loads(evaluate("JSON.stringify({text:startButton.textContent.replace(/\\s+/g,' ').trim(),href:startButton.getAttribute('href'),label:selectedLabel.textContent})"))
        assert changed["text"] == "Alusta API 3→" and changed["href"] == "./api3/", changed

        command("Page.navigate", {"url": URL + "api1/"})
        wait_for_path("/api1/")
        assert evaluate("document.querySelector('.api-version-select').value") == "../api1/"
        assert "ANDMEPÄDEVUS ·" in evaluate("document.querySelector('.api-eyebrow').textContent")
        api1 = header_state()
        screenshot("api1-header.png")

        evaluate("document.querySelector('.api-version-select').value='../api2/'; document.querySelector('.api-version-select').dispatchEvent(new Event('change',{bubbles:true}))")
        wait_for_path("/api2/")
        assert evaluate("document.querySelector('.api-version-select').value") == "../api2/"
        api2 = header_state()
        screenshot("api2-header.png")

        evaluate("document.querySelector('.api-version-select').value='../api3/'; document.querySelector('.api-version-select').dispatchEvent(new Event('change',{bubbles:true}))")
        wait_for_path("/api3/")
        api3 = json.loads(evaluate("JSON.stringify({selected:document.querySelector('.api-version-select').value,title:document.title,heading:document.querySelector('h1').getAttribute('aria-label')})"))
        assert api3["selected"] == "../api3/" and api3["title"].startswith("API 3"), api3
        api3_header = header_state()
        screenshot("api3-header.png")

        headers = [api1, api2, api3_header]
        assert all(item["heading"] == "API päringust vastuseni" for item in headers), headers
        assert all(item["mission"] == "PRAKTIKUMI EDENEMINE" for item in headers), headers
        assert all(item["completed"] == "0" and not item["overflow"] for item in headers), headers
        assert len({item["headingSize"] for item in headers}) == 1, headers
        assert len({item["headingLineHeight"] for item in headers}) == 1, headers
        assert len({item["subtitleSize"] for item in headers}) == 1, headers

        command("Page.navigate", {"url": URL})
        wait_for_path("/")
        command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        command("Page.reload", {"ignoreCache": True})
        time.sleep(0.7)
        mobile = json.loads(evaluate("JSON.stringify({width:innerWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,cards:document.querySelectorAll('.api-card').length,selected:document.querySelector('input:checked').value})"))
        assert mobile == {"width": 390, "overflow": False, "cards": 3, "selected": "api1"}, mobile
        screenshot("launcher-mobile.png")

        mobile_headers = []
        for number in (1, 2, 3):
            command("Page.navigate", {"url": URL + f"api{number}/"})
            wait_for_path(f"/api{number}/")
            mobile_headers.append(header_state())
        assert all(not item["overflow"] for item in mobile_headers), mobile_headers
        assert len({item["headingSize"] for item in mobile_headers}) == 1, mobile_headers
        assert len({item["subtitleSize"] for item in mobile_headers}) == 1, mobile_headers
        screenshot("api3-header-mobile.png")

        print(json.dumps({"landing": landing, "changed": changed, "headers": headers, "mobile": mobile, "mobileHeaders": mobile_headers}, indent=2))
    finally:
        try:
            ws.close()
        except Exception:
            pass
        process.terminate()
        process.wait(timeout=5)
