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
                model: document.querySelector('.site-footer').textContent.includes('VS Code · OpenAI Codex · GPT-5.6 Sol · Extra High'),
                method: document.querySelector('.site-footer').textContent.includes('Spec-driven · AI-supported coding'),
                workflow: document.querySelector('.footer-workflow strong')?.textContent.trim(),
                note: Boolean(document.querySelector('.site-footer .footer-note')),
                footerGap: Math.round(document.documentElement.scrollHeight - (document.querySelector('.site-footer').getBoundingClientRect().bottom + scrollY)),
                overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
              };
            })())"""))

        def shared_style_state():
            return json.loads(evaluate("""JSON.stringify((() => {
              const read = (selector, properties) => {
                const element = document.querySelector(selector);
                if (!element) return null;
                const style = getComputedStyle(element);
                return Object.fromEntries(properties.map(property => [property, style[property]]));
              };
              return {
                briefing: read('.briefing-card', ['padding', 'borderRadius', 'marginTop', 'marginBottom', 'fontSize']),
                step: read('.step', ['minHeight', 'padding', 'borderRadius', 'gap']),
                lab: read('.lab-grid', ['columnGap', 'rowGap']),
                card: read('.control-card.card', ['borderRadius', 'borderColor', 'backgroundColor']),
                control: read('.control-card', ['padding']),
                stage: read('.stage-card', ['padding']),
                kicker: read('.control-head .section-kicker', ['fontSize', 'lineHeight', 'letterSpacing', 'color']),
                button: read('.primary-button', ['minHeight', 'fontSize', 'borderRadius']),
                footer: read('.site-footer', ['marginTop', 'paddingTop', 'borderTopColor']),
                monogram: read('.footer-monogram', ['width', 'height', 'borderRadius']),
                footerLabel: read('.footer-author small', ['fontSize', 'lineHeight']),
                footerStrong: read('.footer-details strong', ['fontSize', 'lineHeight'])
              };
            })())"""))

        command("Page.enable")
        command("Runtime.enable")
        command("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
        command("Page.reload", {"ignoreCache": True})
        time.sleep(0.8)

        landing = json.loads(evaluate("""JSON.stringify({
          title: document.title,
          heroTitle: document.querySelector('.hero-grid h1').textContent.trim(),
          chooseTitle: document.querySelector('#chooseTitle').textContent.trim(),
          cards: document.querySelectorAll('.api-card').length,
          selected: document.querySelector('input[name="api-version"]:checked').value,
          startText: startButton.textContent.replace(/\\s+/g, ' ').trim(),
          startHref: startButton.getAttribute('href'),
          footerDetails: document.querySelectorAll('.site-footer .footer-detail').length,
          model: document.querySelector('.site-footer').textContent.includes('VS Code · OpenAI Codex · GPT-5.6 Sol · Extra High'),
          method: document.querySelector('.site-footer').textContent.includes('Spec-driven · AI-supported coding'),
          workflow: document.querySelector('.footer-workflow strong').textContent.trim(),
          note: Boolean(document.querySelector('.site-footer .footer-note')),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        })"""))
        assert landing == {
            "title": "Andmepädevus · API-praktikumid",
            "heroTitle": "Vali praktikum, millest alustada.",
            "chooseTitle": "Millise praktikumi valid?",
            "cards": 3,
            "selected": "api1",
            "startText": "Alusta 1. praktikumist→",
            "startHref": "./api1/",
            "footerDetails": 3,
            "model": True,
            "method": True,
            "workflow": "GitHub · GitHub Actions · GitHub Pages",
            "note": True,
            "overflow": False,
        }, landing
        screenshot("launcher-desktop.png")
        evaluate("scrollTo(0, document.documentElement.scrollHeight)")
        time.sleep(0.3)
        screenshot("launcher-footer.png")
        evaluate("scrollTo(0, 0)")

        evaluate("document.querySelector('input[value=\"api3\"]').click()")
        changed = json.loads(evaluate("JSON.stringify({text:startButton.textContent.replace(/\\s+/g,' ').trim(),href:startButton.getAttribute('href'),label:selectedLabel.textContent})"))
        assert changed["text"] == "Alusta 3. praktikumist→" and changed["href"] == "./api3/", changed

        command("Page.navigate", {"url": URL + "api1/"})
        wait_for_path("/api1/")
        assert evaluate("document.querySelector('.api-version-select').value") == "../api1/"
        assert "ANDMEPÄDEVUS ·" in evaluate("document.querySelector('.api-eyebrow').textContent")
        api1 = header_state()
        api1_style = shared_style_state()
        assert evaluate("Boolean(document.querySelector('.next-action-guide.contextual.next-target'))")
        assert not evaluate("performance.getEntriesByType('resource').some(entry => entry.name.includes('fonts.googleapis.com'))")
        screenshot("api1-header.png")
        evaluate("scrollTo(0, document.documentElement.scrollHeight)")
        time.sleep(0.3)
        screenshot("api1-footer.png")
        evaluate("scrollTo(0, 0)")
        evaluate("getMetadata.click()")
        time.sleep(0.2)
        assert evaluate("flowDialog.open && getMetadata.disabled")

        evaluate("document.querySelector('.api-version-select').value='../api2/'; document.querySelector('.api-version-select').dispatchEvent(new Event('change',{bubbles:true}))")
        wait_for_path("/api2/")
        assert evaluate("document.querySelector('.api-version-select').value") == "../api2/"
        api2 = header_state()
        api2_style = shared_style_state()
        assert evaluate("Boolean(document.querySelector('.next-action-guide.contextual.next-target'))")
        assert not evaluate("performance.getEntriesByType('resource').some(entry => entry.name.includes('fonts.googleapis.com'))")
        screenshot("api2-header.png")
        evaluate("scrollTo(0, document.documentElement.scrollHeight)")
        time.sleep(0.3)
        screenshot("api2-footer.png")
        evaluate("scrollTo(0, 0)")
        evaluate("getMetadata.click()")
        time.sleep(0.2)
        assert evaluate("flowDialog.open && getMetadata.disabled")

        evaluate("document.querySelector('.api-version-select').value='../api3/'; document.querySelector('.api-version-select').dispatchEvent(new Event('change',{bubbles:true}))")
        wait_for_path("/api3/")
        api3 = json.loads(evaluate("JSON.stringify({selected:document.querySelector('.api-version-select').value,title:document.title,heading:document.querySelector('h1').getAttribute('aria-label')})"))
        assert api3["selected"] == "../api3/" and api3["title"].startswith("API 3"), api3
        api3_header = header_state()
        api3_style = shared_style_state()
        screenshot("api3-header.png")
        evaluate("scrollTo(0, document.documentElement.scrollHeight)")
        time.sleep(0.3)
        screenshot("api3-footer.png")
        evaluate("scrollTo(0, 0)")

        planner = json.loads(evaluate("""JSON.stringify((() => {
          practiceSuite.classList.remove('locked');
          const choices = {
            useCaseInput: 'statistics', environmentInput: 'r', triggerInput: 'button',
            sourceInput: 'statistics-api', sensitivityInput: 'public', aiRoleInput: 'explain',
            modelInput: 'gemini', formatInput: 'json', visualInput: 'chart',
            controlInput: 'facts', fallbackInput: 'retry'
          };
          Object.entries(choices).forEach(([id, value]) => {
            const select = document.getElementById(id);
            select.value = value;
            select.dispatchEvent(new Event('change', {bubbles: true}));
          });
          return {
            state: plannerState.textContent.trim(),
            visualSectionRemoved: !document.querySelector('.output-visual'),
            checks: document.querySelectorAll('.decision-checks .good').length,
            summaryGood: plannerSummary.classList.contains('good'),
            quality: qualityScore.textContent.trim(),
            launchpadRemoved: !document.querySelector('.practice-launchpad'),
            request: plannerRequest.textContent.includes('/v1beta/models/gemini:generateContent')
          };
        })())"""))
        assert planner == {
            "state": "11 / 11 valikut",
            "visualSectionRemoved": True,
            "checks": 4,
            "summaryGood": False,
            "quality": "100",
            "launchpadRemoved": True,
            "request": True,
        }, planner
        evaluate("buildWorkflow.click(); practiceSuite.scrollIntoView({block:'start'})")
        time.sleep(0.4)
        assert evaluate("plannerSummary.classList.contains('good') && !document.querySelector('.output-visual')")
        screenshot("api3-planner-workflow.png")

        learning_features = json.loads(evaluate("""JSON.stringify((() => {
          stressInput.value = 'rate-limit';
          stressInput.dispatchEvent(new Event('change', {bubbles:true}));
          const stressWorks = stressResult.classList.contains('good');
          const choices = {
            useCaseInput: 'documents', environmentInput: 'python', triggerInput: 'batch',
            sourceInput: 'documents', sensitivityInput: 'internal', aiRoleInput: 'extract',
            modelInput: 'local', formatInput: 'schema', visualInput: 'json',
            controlInput: 'approve', fallbackInput: 'manual'
          };
          Object.entries(choices).forEach(([id, value]) => {
            const select = document.getElementById(id);
            select.value = value;
            select.dispatchEvent(new Event('change', {bubbles:true}));
          });
          return {
            stressWorks,
            useCase: useCaseInput.value,
            quality: qualityScore.textContent.trim(),
            request: plannerRequest.textContent.includes('/v1/chat/completions')
          };
        })())"""))
        assert learning_features == {"stressWorks": True, "useCase": "documents", "quality": "98", "request": True}, learning_features
        evaluate("practiceSuite.scrollIntoView({block:'start'})")
        time.sleep(0.5)
        screenshot("api3-planner-learning.png")
        evaluate("document.querySelector('.stress-lab').scrollIntoView({block:'center'})")
        time.sleep(0.5)
        screenshot("api3-planner-stress.png")

        headers = [api1, api2, api3_header]
        assert all(item["heading"] == "API päringust vastuseni" for item in headers), headers
        assert all(item["model"] and item["method"] for item in headers), headers
        assert all(item["workflow"] == "GitHub · GitHub Actions · GitHub Pages" for item in headers), headers
        assert all(item["note"] for item in headers), headers
        assert all(item["footerGap"] <= 40 for item in headers), headers
        assert all(item["mission"] == "PRAKTIKUMI EDENEMINE" for item in headers), headers
        assert all(item["completed"] == "0" and not item["overflow"] for item in headers), headers
        assert len({item["headingSize"] for item in headers}) == 1, headers
        assert len({item["headingLineHeight"] for item in headers}) == 1, headers
        assert len({item["subtitleSize"] for item in headers}) == 1, headers

        shared_styles = [api1_style, api2_style, api3_style]
        for key in ("briefing", "lab", "card", "control", "stage", "kicker", "button", "footer", "monogram", "footerLabel", "footerStrong"):
            assert len({json.dumps(item[key], sort_keys=True) for item in shared_styles}) == 1, {key: [item[key] for item in shared_styles]}
        assert not evaluate("performance.getEntriesByType('resource').some(entry => entry.name.includes('fonts.googleapis.com'))")

        command("Page.navigate", {"url": URL})
        wait_for_path("/")
        command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        command("Page.reload", {"ignoreCache": True})
        time.sleep(0.7)
        mobile = json.loads(evaluate("JSON.stringify({width:innerWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,cards:document.querySelectorAll('.api-card').length,selected:document.querySelector('input:checked').value,footerColumns:getComputedStyle(document.querySelector('.footer-details')).gridTemplateColumns.split(' ').length,footerNote:Boolean(document.querySelector('.site-footer .footer-note'))})"))
        assert mobile == {"width": 390, "overflow": False, "cards": 3, "selected": "api1", "footerColumns": 1, "footerNote": True}, mobile
        screenshot("launcher-mobile.png")
        evaluate("scrollTo(0, document.documentElement.scrollHeight)")
        time.sleep(0.3)
        screenshot("launcher-footer-mobile.png")

        mobile_headers = []
        for number in (1, 2, 3):
            command("Page.navigate", {"url": URL + f"api{number}/"})
            wait_for_path(f"/api{number}/")
            mobile_headers.append(header_state())
        assert all(not item["overflow"] for item in mobile_headers), mobile_headers
        assert len({item["headingSize"] for item in mobile_headers}) == 1, mobile_headers
        assert len({item["subtitleSize"] for item in mobile_headers}) == 1, mobile_headers
        screenshot("api3-header-mobile.png")

        mobile_planner = json.loads(evaluate("""JSON.stringify((() => {
          practiceSuite.classList.remove('locked');
          useCaseInput.value = 'survey';
          useCaseInput.dispatchEvent(new Event('change', {bubbles:true}));
          visualInput.value = 'chart';
          visualInput.dispatchEvent(new Event('change', {bubbles:true}));
          workflowDiagram.scrollIntoView({block:'center'});
          return {
            columns: getComputedStyle(document.querySelector('.planner-grid')).gridTemplateColumns.split(' ').length,
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            previewFits: document.querySelector('.workflow-preview').getBoundingClientRect().width <= innerWidth,
            visualSectionRemoved: !document.querySelector('.output-visual')
          };
        })())"""))
        assert mobile_planner == {"columns": 1, "overflow": False, "previewFits": True, "visualSectionRemoved": True}, mobile_planner
        time.sleep(0.6)
        screenshot("api3-planner-mobile.png")
        evaluate("practiceSuite.scrollIntoView({block:'start'})")
        time.sleep(0.6)
        screenshot("api3-planner-learning-mobile.png")

        print(json.dumps({"landing": landing, "changed": changed, "headers": headers, "sharedStyles": shared_styles, "planner": planner, "learningFeatures": learning_features, "mobile": mobile, "mobileHeaders": mobile_headers, "mobilePlanner": mobile_planner}, indent=2))
    finally:
        try:
            ws.close()
        except Exception:
            pass
        process.terminate()
        process.wait(timeout=5)
