(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const TOTAL_STEPS = 5;
  const requestSteps = new Set([1, 3, 4]);

  const stepContent = {
    1: { title: "Vaata, mida saab küsida", story: "<b>Alusta tabeli kirjeldusest.</b> GET-päring näitab, milliseid andmeid saab küsida." },
    2: { title: "Vali soovitud andmed", story: "<b>Vali metaandmete põhjal näitaja, tegevusala ja vaatlusperiood.</b> Iga muudatus uuendab all olevat POST-päringut automaatselt, nii et näed kohe päringu keha muutumist." },
    3: { title: "Küsi valitud andmed", story: "<b>POST-päring saadab sinu valiku Statistikaameti API-le JSON-vormingus.</b> Vastus sisaldab just valitud näitaja, tegevusala ja perioodide väärtusi." },
    4: { title: "Saada arvutatud tulemus Gemini API-le", story: "<b>Vastus on vaadatud.</b> Nüüd kontrolli vastuse sisu ja tähendust." },
    5: { title: "Kontrolli mõlemat API vastust", story: "<b>200 OK kinnitab ainult tehnilist õnnestumist.</b> Kontrolli Statistikaameti valikut ja ühikut ning seejärel seda, kas mudel kasutas samu arve ega lisanud väljamõeldud põhjuseid." }
  };

  const outputs = {
    1: `GET /api/v1/et/stat/PA111\nAccept: application/json\n\nHTTP/1.1 200 OK\n\nMETAANDMED\n• Näitaja — 12 võimalikku valikut\n• Tegevusala — 20 võimalikku valikut\n• Vaatlusperiood — 22 võimalikku valikut\n\nPalgaväärtusi vastuses veel ei ole.`,
    2: `> valik\n$Näitaja\n[1] "GR_W_AVG"\n\n$Tegevusala\n[1] "TOTAL"\n\n$Vaatlusperiood\n[1] "2024Q2" "2025Q2" "2026Q2"\n\nValik on R-is valmis: 1 × 1 × 3 = 3 väärtust.`,
    3: `> vastus <- pxweb_get(url, query = valik)\n\nHTTP POST → PA111\nStatus: 200 OK\nResponse: PXWEB_DATASET\nDimensions: 1 × 1 × 3\nValues: 2007, 2126, 2243\n\nVastus salvestati R-i objekti "vastus".`,
    4: `R-I ARVUTUS\n2243 − 2007 = +236 eurot\n(2243 / 2007 − 1) × 100 = +11,8%\n\nPOST /v1beta/interactions\nx-goog-api-key: [REDACTED]\nApi-Revision: 2026-05-20\nContent-Type: application/json\n\n{\n  "model": "gemini-3.6-flash",\n  "input": "2024 II kv: 2007 €; 2026 II kv: 2243 €; muutus +236 € (+11,8%). Selgita kahe lausega. Ära oleta põhjuseid.",\n  "store": false\n}\n\nHTTP/1.1 200 OK\nMudeli vastus saabus JSON-ina.`,
    5: `MÕLEMA VASTUSE KONTROLL\n\nSTATISTIKAAMET\n✓ näitaja GR_W_AVG\n✓ tegevusala TOTAL\n✓ kolm II kvartalit\n✓ väärtused 2007, 2126, 2243 eurot\n\nGEMINI\n✓ samad algarvud\n✓ R-i arvutus +236 eurot ja +11,8%\n✓ õige ühik\n✓ põhjuseid ei oletata`
  };

  const metadataSample = `{
  "title": "PA111: Keskmine brutokuupalk",
  "variables": [
    { "code": "Näitaja", "values": ["GR_W_AVG", "..."] },
    { "code": "Tegevusala", "values": ["TOTAL", "..."] },
    { "code": "Vaatlusperiood", "values": ["2024Q2", "2025Q2", "2026Q2", "..."] }
  ]
}`;

  const statisticsSample = `{
  "class": "dataset",
  "label": "PA111: Keskmine brutokuupalk",
  "size": [1, 1, 3],
  "period": ["2024Q2", "2025Q2", "2026Q2"],
  "value": [2007, 2126, 2243],
  "unit": "eurot"
}`;

  const aiSample = `{
  "id": "interaction_demo",
  "status": "completed",
  "steps": [{
    "type": "model_output",
    "content": [{
      "type": "text",
      "text": "Keskmine brutokuupalk suurenes 2024. aasta II kvartalist 2026. aasta II kvartalini 236 euro ehk 11,8%. Need arvud kirjeldavad muutust, kuid ei näita selle põhjust."
    }]
  }]
}`;

  const metadataOptions = {
    indicators: [
      ["GR_W_AVG", "Keskmine brutokuupalk, eurot"],
      ["NR_EMPL", "Töötajate arv"],
      ["GR_W_D1", "Brutokuupalga I detsiil, eurot"],
      ["GR_W_D2", "Brutokuupalga II detsiil, eurot"],
      ["GR_W_D3", "Brutokuupalga III detsiil, eurot"],
      ["GR_W_D4", "Brutokuupalga IV detsiil, eurot"],
      ["GR_W_D5", "Brutokuupalga mediaan (V detsiil), eurot"],
      ["GR_W_D6", "Brutokuupalga VI detsiil, eurot"],
      ["GR_W_D7", "Brutokuupalga VII detsiil, eurot"],
      ["GR_W_D8", "Brutokuupalga VIII detsiil, eurot"],
      ["GR_W_D9", "Brutokuupalga IX detsiil, eurot"],
      ["GR_W_AVG_SM", "Keskmise brutokuupalga muutus võrreldes eelmise aasta sama perioodiga, %"]
    ],
    activities: [
      ["TOTAL", "Kokku – kõik tegevusalad"],
      ["A", "Põllumajandus, metsamajandus ja kalapüük"],
      ["B", "Mäetööstus"],
      ["C", "Töötlev tööstus"],
      ["D", "Elektrienergia, gaasi, auru ja konditsioneeritud õhuga varustamine"],
      ["E", "Veevarustus; kanalisatsioon; jäätme- ja saastekäitlus"],
      ["F", "Ehitus"],
      ["G", "Hulgi- ja jaekaubandus; mootorsõidukite ja mootorrataste remont"],
      ["H", "Veondus ja laondus"],
      ["I", "Majutus ja toitlustus"],
      ["J", "Info ja side"],
      ["K", "Finants- ja kindlustustegevus"],
      ["L", "Kinnisvaraalane tegevus"],
      ["M", "Kutse-, teadus- ja tehnikaalane tegevus"],
      ["N", "Haldus- ja abitegevused"],
      ["O", "Avalik haldus ja riigikaitse; kohustuslik sotsiaalkindlustus"],
      ["P", "Haridus"],
      ["Q", "Tervishoid ja sotsiaalhoolekanne"],
      ["R", "Kunst, meelelahutus ja vaba aeg"],
      ["S", "Muud teenindavad tegevused"]
    ],
    periods: [
      ["2021Q1", "I kv"], ["2021Q2", "II kv"], ["2021Q3", "III kv"], ["2021Q4", "IV kv"],
      ["2022Q1", "I kv"], ["2022Q2", "II kv"], ["2022Q3", "III kv"], ["2022Q4", "IV kv"],
      ["2023Q1", "I kv"], ["2023Q2", "II kv"], ["2023Q3", "III kv"], ["2023Q4", "IV kv"],
      ["2024Q1", "I kv"], ["2024Q2", "II kv"], ["2024Q3", "III kv"], ["2024Q4", "IV kv"],
      ["2025Q1", "I kv"], ["2025Q2", "II kv"], ["2025Q3", "III kv"], ["2025Q4", "IV kv"],
      ["2026Q1", "I kv"], ["2026Q2", "II kv"]
    ]
  };
  const defaultPeriods = new Set(["2024Q2", "2025Q2", "2026Q2"]);
  const officialWages = Object.freeze({ "2024Q2": 2007, "2025Q2": 2126, "2026Q2": 2243 });

  const runLabels = [
    "Küsi metaandmed",
    "Kinnita valik",
    "Saada POST-päring",
    "Saada andmed mudelile",
    "Kontrolli ja tõlgenda"
  ];
  const completedLabels = [
    "Metaandmed saadud",
    "Valik kinnitatud",
    "POST-päring saadetud",
    "Andmed mudelile saadetud",
    "Kontroll tehtud"
  ];

  let currentStep = 1;
  let completed = 0;
  let running = false;
  const els = {
    progressValue: $("#progressValue"),
    progressText: $("#progressText"),
    progressBar: $("#progressBar"),
    completedCount: $("#completedCount"),
    stageTitle: $("#stageTitle"),
    stageCard: $("#stageCard"),
    storyIndex: $("#storyIndex"),
    storyText: $("#storyText"),
    statusChip: $("#statusChip"),
    statusText: $("#statusText"),
    responseContext: $("#responseContext"),
    responseContextLabel: $("#responseContextLabel"),
    responseContextText: $("#responseContextText"),
    consoleOutput: $("#consoleOutput"),
    consoleBadge: $("#consoleBadge"),
    terminalTitle: $("#terminalTitle"),
    currentStepLabel: $("#currentStepLabel"),
    prevLesson: $("#prevLesson"),
    nextLesson: $("#nextLesson"),
    lessonDots: $("#lessonDots"),
    flowMap: $("#flowMap"),
    flowPackage: $("#flowPackage"),
    flowApi: $("#flowApi"),
    flowMethodLabel: $("#flowMethodLabel"),
    flowApiRole: $("#flowApiRole"),
    flowApiName: $("#flowApiName"),
    jsonEmpty: $("#jsonEmpty"),
    jsonOutput: $("#jsonOutput"),
    postResponseOutput: $("#postResponseOutput"),
    postChartTitle: $("#postChartTitle"),
    postBarChart: $("#postBarChart"),
    postChartInsight: $("#postChartInsight"),
    selectionFields: $("#selectionFields"),
    indicatorSelect: $("#indicatorSelect"),
    activitySelect: $("#activitySelect"),
    periodOptions: $("#periodOptions"),
    selectionMath: $("#selectionMath"),
    valueCount: $("#valueCount"),
    selectionFeedback: $("#selectionFeedback"),
    selectionAction: $("#selectionAction"),
    modelGuide: $("#modelGuide"),
    resultEmpty: $("#resultEmpty"),
    resultContent: $("#resultContent"),
    practiceSuite: $("#practiceSuite"),
    flowDialog: $("#flowDialog"),
    flowDialogKicker: $("#flowDialogKicker"),
    dialogFlowStage: $("#dialogFlowStage"),
    dialogFlowStatus: $("#dialogFlowStatus"),
    flowDialogResult: $("#flowDialogResult"),
    flowDialogClose: $("#flowDialogClose"),
    dialogApiName: $("#dialogApiName"),
    dialogServiceIcon: $("#dialogServiceIcon"),
    dialogServiceRole: $("#dialogServiceRole"),
    dialogServiceName: $("#dialogServiceName"),
    dialogServiceAction: $("#dialogServiceAction"),
    toast: $("#toast")
  };

  function syncHeight() {
    const params = new URLSearchParams(location.search);
    if (window.self === window.top && params.get("embed") !== "1" && params.get("embedMode") !== "1") return;
    const height = Math.ceil(document.documentElement.scrollHeight);
    window.parent.postMessage({ type: "simfluence:resize", height }, "*");
    window.parent.postMessage({ type: "resize", height }, "*");
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    window.setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  function alignResponseWithLesson(step) {
    const desktop = window.matchMedia("(min-width: 1001px)").matches;
    const lesson = $(`[data-lesson="${step}"]`);
    const target = desktop && lesson ? lesson : els.stageCard;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setResponseContext(label, message, kind = "neutral") {
    els.responseContextLabel.textContent = label;
    els.responseContextText.textContent = message;
    els.responseContext.className = `response-context ${kind}`;
  }

  function populateSelectionOptions() {
    const fillSelect = (select, options) => {
      select.replaceChildren(...options.map(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = `${label} · ${value}`;
        return option;
      }));
    };
    fillSelect(els.indicatorSelect, metadataOptions.indicators);
    fillSelect(els.activitySelect, metadataOptions.activities);

    const years = new Map();
    metadataOptions.periods.forEach(([value, label]) => {
      const year = value.slice(0, 4);
      if (!years.has(year)) years.set(year, []);
      years.get(year).push([value, label]);
    });
    els.periodOptions.replaceChildren(...[...years].map(([year, periods]) => {
      const group = document.createElement("div");
      group.className = "period-year";
      const heading = document.createElement("b");
      heading.textContent = year;
      const grid = document.createElement("div");
      grid.className = "period-year-grid";
      periods.forEach(([value, label]) => {
        const item = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = value;
        input.checked = defaultPeriods.has(value);
        const text = document.createElement("span");
        text.className = "period-label";
        text.textContent = label;
        item.append(input, text);
        grid.append(item);
      });
      group.append(heading, grid);
      return group;
    }));
  }

  function selectedPeriods() {
    return $$("input[type='checkbox']:checked", els.periodOptions).map((input) => input.value);
  }

  function requestBody() {
    return {
      query: [
        { code: "Näitaja", selection: { filter: "item", values: [els.indicatorSelect.value] } },
        { code: "Tegevusala", selection: { filter: "item", values: [els.activitySelect.value] } },
        { code: "Vaatlusperiood", selection: { filter: "item", values: selectedPeriods() } }
      ],
      response: { format: "json-stat2" }
    };
  }

  function fullPostRequest() {
    return [
      "POST https://andmed.stat.ee/api/v1/et/stat/PA111",
      "Content-Type: application/json",
      "Accept: application/json",
      "",
      JSON.stringify(requestBody(), null, 2)
    ].join("\n");
  }

  function updateRequestPreview() {
    const count = selectedPeriods().length;
    els.selectionMath.textContent = `1 × 1 × ${count}`;
    els.valueCount.textContent = `= ${count} ${count === 1 ? "väärtus" : "väärtust"}`;
    $("#code2").textContent = fullPostRequest();
    els.selectionFeedback.className = `selection-feedback ${count ? "" : "error"}`.trim();
    els.selectionFeedback.textContent = count
      ? "Valitud POST-päring uuenes automaatselt."
      : "Vali vähemalt üks vaatlusperiood.";
    syncHeight();
  }

  function indicatorUnit() {
    if (els.indicatorSelect.value === "NR_EMPL") return "tuh";
    if (els.indicatorSelect.value === "GR_W_AVG_SM") return "%";
    return "€";
  }

  function simulatedValue(period) {
    const indicator = els.indicatorSelect.value;
    if (indicator === "GR_W_AVG" && els.activitySelect.value === "TOTAL" && Object.hasOwn(officialWages, period)) {
      return officialWages[period];
    }
    const activityIndex = metadataOptions.activities.findIndex(([code]) => code === els.activitySelect.value);
    const year = Number(period.slice(0, 4));
    const quarter = Number(period.slice(-1));
    const timeIndex = (year - 2024) * 4 + quarter - 2;
    if (indicator === "NR_EMPL") return Number((100 + timeIndex * 0.7 + activityIndex * 1.2).toFixed(1));
    if (indicator === "GR_W_AVG_SM") return Number((5.2 + timeIndex * 0.08 - activityIndex * 0.05).toFixed(1));
    const wageBase = {
      GR_W_AVG: 2007, GR_W_D1: 1150, GR_W_D2: 1320, GR_W_D3: 1490, GR_W_D4: 1660,
      GR_W_D5: 1840, GR_W_D6: 2030, GR_W_D7: 2260, GR_W_D8: 2570, GR_W_D9: 3100
    }[indicator] || 2007;
    return Math.max(1, Math.round(wageBase + timeIndex * 35 + activityIndex * 12));
  }

  function formatValue(value) {
    const [whole, fraction] = String(value).split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
    return fraction ? `${grouped},${fraction}` : grouped;
  }

  function formatPeriod(period) {
    const quarters = { Q1: "I kv", Q2: "II kv", Q3: "III kv", Q4: "IV kv" };
    return `${period.slice(0, 4)} ${quarters[period.slice(4)]}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function usesOfficialValues(periods) {
    return els.indicatorSelect.value === "GR_W_AVG"
      && els.activitySelect.value === "TOTAL"
      && periods.every((period) => Object.hasOwn(officialWages, period));
  }

  function linkedPostResponse(data, periods, values) {
    const indicator = els.indicatorSelect.value;
    const activity = els.activitySelect.value;
    const unit = indicatorUnit();
    let insideValues = false;
    let valueIndex = 0;

    return JSON.stringify(data, null, 2).split("\n").map((line) => {
      const trimmed = line.trim();
      if (trimmed === '"values": [') {
        insideValues = true;
        return escapeHtml(line);
      }
      if (insideValues && /^\],?$/.test(trimmed)) {
        insideValues = false;
        return escapeHtml(line);
      }
      if (insideValues) {
        const valueMatch = line.match(/^(\s*)(-?\d+(?:\.\d+)?)(,?)$/);
        if (valueMatch) {
          const index = valueIndex++;
          const hint = `API tagastas: ${formatValue(values[index])} ${unit} · ${indicator} · ${activity} · ${periods[index]}`;
          return `${escapeHtml(valueMatch[1])}<span class="response-value" tabindex="0" data-result-index="${index}" title="${escapeHtml(hint)}" aria-label="${escapeHtml(hint)}">${escapeHtml(valueMatch[2])}</span>${valueMatch[3]}`;
        }
      }

      const codeMatch = line.match(/^(\s*)"([^"]+)"(,?)$/);
      if (codeMatch) {
        const code = codeMatch[2];
        const periodIndex = periods.indexOf(code);
        if (code === indicator || code === activity) {
          return `${escapeHtml(codeMatch[1])}<span class="response-code request-code-shared" title="Päringus valitud kood">&quot;${escapeHtml(code)}&quot;</span>${codeMatch[3]}`;
        }
        if (periodIndex !== -1) {
          return `${escapeHtml(codeMatch[1])}<span class="response-code" data-result-index="${periodIndex}" title="Päringus valitud periood">&quot;${escapeHtml(code)}&quot;</span>${codeMatch[3]}`;
        }
      }
      return escapeHtml(line);
    }).join("\n");
  }

  function toggleResultLinks(index, active) {
    els.postResponseOutput
      .querySelectorAll(`[data-result-index="${index}"], .request-code-shared`)
      .forEach((item) => item.classList.toggle("is-linked", active));
  }

  function renderSelectedData() {
    const periods = selectedPeriods();
    const values = periods.map(simulatedValue);
    const unit = indicatorUnit();
    const official = usesOfficialValues(periods);
    const response = {
      class: "dataset",
      label: official ? "PA111 vastus" : "Näitlik vastus",
      id: ["Näitaja", "Tegevusala", "Vaatlusperiood"],
      size: [1, 1, periods.length],
      dimension: {
        Näitaja: { category: { index: [els.indicatorSelect.value] } },
        Tegevusala: { category: { index: [els.activitySelect.value] } },
        Vaatlusperiood: { category: { index: periods } }
      },
      values,
      note: official
        ? "PA111 ametliku tabeli kontrollväärtused"
        : "Õppeandmed — mitte ametlik statistika"
    };
    els.postResponseOutput.innerHTML = `<code>${linkedPostResponse(response, periods, values)}</code>`;

    const max = Math.max(...values);
    const min = Math.min(...values);
    els.postChartTitle.textContent = els.indicatorSelect.selectedOptions[0].textContent.split(" · ")[0];
    els.postBarChart.innerHTML = periods.map((period, index) => {
      const height = 45 + (Math.abs(values[index]) / Math.max(...values.map(Math.abs), 1)) * 50;
      return `<div class="chart-column"><span class="chart-value">${escapeHtml(formatValue(values[index]))} ${escapeHtml(unit)}</span><i class="chart-bar" style="--bar-height:${height}%"></i><span class="chart-label">${escapeHtml(formatPeriod(period))}</span></div>`;
    }).join("");
    els.postBarChart.setAttribute("aria-label", periods.map((period, index) => `${formatPeriod(period)} ${formatValue(values[index])} ${unit}`).join(", "));
    const change = max === min
      ? "Väärtused on võrdsed"
      : `Vastuse väärtuste vahe: ${formatValue(Number((max - min).toFixed(1)))} ${unit}`;
    els.postChartInsight.innerHTML = `<span>↗</span><b>${escapeHtml(change)}.</b> Muutus on nähtav. Enne järeldust kontrolli näitaja tähendust.`;
  }

  function selectionConsoleOutput() {
    const periods = selectedPeriods();
    return `VALIK ON VALMIS\n\nNäitaja        → ${els.indicatorSelect.value}\nTegevusala     → ${els.activitySelect.value}\nVaatlusperiood → ${periods.join(", ")}\n\nOodatav vastuse maht:\n1 näitaja × 1 tegevusala × ${periods.length} perioodi = ${periods.length} väärtust\n\nPOST-päringu keha uuenes automaatselt.`;
  }

  function postConsoleOutput() {
    const periods = selectedPeriods();
    const values = periods.map(simulatedValue);
    return `POST /api/v1/et/stat/PA111\nContent-Type: application/json\nAccept: application/json\n\nHTTP/1.1 200 OK\nResponse: JSON-STAT2\nDimensions: 1 × 1 × ${periods.length}\nCodes: ${els.indicatorSelect.value} · ${els.activitySelect.value}\nPeriods: ${periods.join(", ")}\nValues: ${values.join(", ")}\n\nVastus salvestati R-i objekti "vastus".`;
  }

  function updateProgress() {
    const labels = ["Küsi metaandmed", "Vali soovitud andmed", "Saada POST-päring", "Saada Gemini POST", "Kontrolli vastuseid", "Töövoog on valmis"];
    const percent = Math.round((completed / TOTAL_STEPS) * 100);
    els.progressValue.textContent = `${percent}%`;
    els.progressText.textContent = labels[completed];
    els.progressBar.style.width = `${percent}%`;
    els.completedCount.textContent = completed;
    $$(".step").forEach((step) => {
      const number = Number(step.dataset.step);
      step.classList.toggle("done", number <= completed);
      step.disabled = number > completed + 1;
    });
  }

  function renderDots() {
    els.lessonDots.innerHTML = Array.from({ length: TOTAL_STEPS }, (_, index) => {
      const step = index + 1;
      const className = step === currentStep ? "active" : step <= completed ? "done" : "";
      return `<i class="${className}"></i>`;
    }).join("");
  }

  function showStep(step, scroll = false) {
    if (step < 1 || step > TOTAL_STEPS || step > completed + 1 || running) return;
    currentStep = step;
    const visibleLesson = step === 3 ? 2 : step;
    $$(".lesson-panel").forEach((panel) => {
      const number = Number(panel.dataset.lesson);
      panel.hidden = number > visibleLesson;
      panel.classList.toggle("active", number === visibleLesson);
      panel.classList.toggle("completed", number < visibleLesson && number <= completed);
    });
    if (step === 2) {
      els.selectionAction.dataset.run = "2";
      els.selectionAction.classList.remove("orange");
      els.selectionAction.disabled = completed >= 2;
      els.selectionAction.querySelector("span").textContent = completed >= 2 ? "Valik kinnitatud" : "Kinnita valik";
    } else if (step === 3) {
      els.selectionAction.dataset.run = "3";
      els.selectionAction.classList.add("orange");
      els.selectionAction.disabled = completed >= 3;
      els.selectionAction.querySelector("span").textContent = completed >= 3 ? "POST-päring saadetud" : "Saada POST-päring";
      if (completed < 3) {
        els.selectionFeedback.className = "selection-feedback success";
        els.selectionFeedback.textContent = "Valik kinnitatud. Saada nüüd POST-päring Statistikaametile.";
      }
    }
    $$(".step").forEach((item) => item.classList.toggle("active", Number(item.dataset.step) === step));
    els.currentStepLabel.textContent = `${step}/${TOTAL_STEPS}`;
    const preserveResponseStage = step === 3 && completed === 2;
    if (!preserveResponseStage) {
      els.storyIndex.textContent = String(step).padStart(2, "0");
      els.storyText.innerHTML = stepContent[step].story;
    }
    els.prevLesson.disabled = step === 1;
    els.nextLesson.disabled = step >= completed + 1 || step === TOTAL_STEPS;
    const aiStep = step === 4;
    els.flowMethodLabel.textContent = aiStep ? "POST" : "GET / POST";
    els.flowApiRole.textContent = aiStep ? "AI TEENUS" : "ANDMEALLIKAS";
    els.flowApiName.textContent = aiStep ? "Gemini API" : "PA111 API";
    els.flowPackage.classList.toggle("active", completed >= 1);
    els.flowApi.classList.toggle("active", completed >= 2);
    renderDots();
    if (scroll) alignResponseWithLesson(step);
    syncHeight();
  }

  function activateTab(panelId) {
    $$(".workspace-panel").forEach((panel) => { panel.hidden = panel.id !== panelId; });
    $$(".tab").forEach((tab) => {
      const active = tab.dataset.panel === panelId;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    syncHeight();
  }

  const dialogConfigs = {
    1: {
      method: "GET",
      api: "Statistikaameti API",
      icon: "PA",
      serviceRole: "ANDMEALLIKAS",
      service: "Tabel PA111",
      serviceAction: "Koostab metaandmed",
      processing: "Tabel PA111 koostab metaandmed",
      result: "<b>200 OK.</b> Statistikaameti API saatis tabeli kirjelduse ja valikukoodid R-i tagasi.",
      close: "Vaata saadud metaandmeid"
    },
    3: {
      method: "POST",
      api: "Statistikaameti API",
      icon: "PA",
      serviceRole: "ANDMEALLIKAS",
      service: "Tabel PA111",
      serviceAction: "Leiab valitud andmed",
      processing: "Tabel PA111 leiab valitud väärtused",
      result: "<b>200 OK.</b> Statistikaameti API saatis kolme II kvartali palgaandmed R-i tagasi.",
      close: "Vaata saadud palgaandmeid"
    },
    4: {
      method: "POST",
      api: "Gemini API",
      icon: "AI",
      serviceRole: "TEENUS",
      service: "Keelemudel",
      serviceAction: "Koostab selgituse",
      processing: "Keelemudel koostab vastuse",
      result: "<b>200 OK.</b> Gemini API saatis mudeli JSON-vastuse R-i tagasi.",
      close: "Vaata saadud AI vastust"
    }
  };

  function openFlowDialog(config) {
    els.flowDialogKicker.textContent = `SINU ${config.method}-PÄRING LIIGUB`;
    els.dialogFlowStatus.textContent = "Valmistab päringut ette";
    els.flowDialogResult.innerHTML = `<b>${config.method}-päring on teel.</b> Vastus pole veel saabunud.`;
    els.flowDialogResult.className = "";
    els.dialogApiName.textContent = config.api;
    els.dialogServiceIcon.textContent = config.icon;
    els.dialogServiceRole.textContent = config.serviceRole;
    els.dialogServiceName.textContent = config.service;
    els.dialogServiceAction.textContent = config.serviceAction;
    els.flowDialogClose.disabled = true;
    els.flowDialogClose.querySelector("span").textContent = "Oota vastust…";
    els.dialogFlowStage.classList.remove("sending", "returning");
    $$(".dialog-node", els.dialogFlowStage).forEach((node) => node.classList.remove("flow-active"));
    if (!els.flowDialog.open) els.flowDialog.showModal();
  }

  function completeFlowDialog(config) {
    els.dialogFlowStatus.textContent = "200 OK · Vastus on käes";
    els.flowDialogResult.innerHTML = config.result;
    els.flowDialogResult.className = "success";
    els.flowDialogClose.querySelector("span").textContent = config.close;
    els.flowDialogClose.disabled = false;
    els.flowDialogClose.focus({ preventScroll: true });
  }

  async function animateDialogFlow(config) {
    const stage = els.dialogFlowStage;
    const nodes = $$(".dialog-node", stage);
    const activate = (index) => nodes.forEach((node, nodeIndex) => node.classList.toggle("flow-active", nodeIndex === index));
    stage.classList.remove("sending", "returning");
    void stage.offsetWidth;

    activate(0);
    els.dialogFlowStatus.textContent = "Klient saadab päringu";
    stage.classList.add("sending");
    await wait(800);

    activate(1);
    els.dialogFlowStatus.textContent = "Päring jõuab API otspunkti";
    await wait(800);

    activate(2);
    els.dialogFlowStatus.textContent = config.processing;
    await wait(800);

    stage.classList.remove("sending");
    void stage.offsetWidth;
    stage.classList.add("returning");
    els.dialogFlowStatus.textContent = "Vastus liigub tagasi";
    await wait(900);

    activate(1);
    await wait(450);
    activate(0);
    els.dialogFlowStatus.textContent = "Klient saab vastuse";
    await wait(450);

    stage.classList.remove("returning");
    nodes.forEach((node) => node.classList.remove("flow-active"));
  }

  async function animateFlow(step) {
    const config = dialogConfigs[step];
    els.flowPackage.classList.add("active");
    if (config) {
      els.flowDialog.dataset.step = String(step);
      openFlowDialog(config);
      els.flowMap.classList.add("sending");
      await animateDialogFlow(config);
      els.flowMap.classList.remove("sending");
      els.flowApi.classList.add("active");
    } else {
      await wait(520);
    }
  }

  async function runStep(step) {
    if (running || step !== currentStep || step > completed + 1) return;
    if ((step === 2 || step === 3) && selectedPeriods().length === 0) {
      els.selectionFeedback.className = "selection-feedback error";
      els.selectionFeedback.textContent = "Vali enne jätkamist vähemalt üks vaatlusperiood.";
      showToast("Vali vähemalt üks vaatlusperiood");
      return;
    }
    running = true;
    const button = $(`[data-run="${step}"]`);
    if (step === 2) {
      button.disabled = true;
      els.selectionFeedback.className = "selection-feedback";
      els.selectionFeedback.textContent = "Valik kinnitatakse…";
      await wait(260);
      completed = Math.max(completed, step);
      button.querySelector("span").textContent = completedLabels[step - 1];
      updateProgress();
      running = false;
      els.nextLesson.disabled = false;
      renderDots();
      await wait(180);
      showStep(3);
      syncHeight();
      return;
    }
    if (step === 4) els.modelGuide.hidden = true;
    if (step === 1) {
      els.stageCard.classList.remove("awaiting-response");
      els.stageCard.removeAttribute("aria-disabled");
    }
    button.disabled = true;
    els.terminalTitle.textContent = ({
      1: "metaandmed.json",
      2: "valik.json",
      3: "andmed.json",
      4: "gemini-vastus.json",
      5: "kontroll.txt"
    })[step];
    els.statusChip.className = "status-chip running";
    els.statusText.textContent = requestSteps.has(step) ? `${dialogConfigs[step].method} LIIGUB` : "SAMM TÖÖTAB";
    els.consoleBadge.textContent = "töötleb…";
    els.consoleBadge.className = "running";
    activateTab("consolePanel");
    els.consoleOutput.textContent = `Samm ${step}: ${stepContent[step].title.toLowerCase()}…`;
    await animateFlow(step);
    els.consoleOutput.textContent = step === 1
      ? metadataSample
      : step === 2
        ? selectionConsoleOutput()
        : step === 3
          ? postConsoleOutput()
          : step === 4
            ? aiSample
            : outputs[step];
    els.consoleBadge.textContent = requestSteps.has(step) ? "200 OK" : "valmis";
    els.consoleBadge.className = requestSteps.has(step) ? "success" : "neutral";
    els.statusChip.className = "status-chip success";
    els.statusText.textContent = step === 3 ? "Vastus käes" : "ÕNNESTUS";

    const responseContexts = {
      1: ["GET-PÄRINGU VASTUS", "Teenus tagastas tabeli muutujad, valikute nimetused ja koodid.", "metadata"],
      2: ["VALIK ON VALMIS", "Metaandmete põhjal koostatud valik määrab järgmise POST-päringu keha.", "metadata"],
      3: ["POST-PÄRINGU VASTUS", "Värvilised arvud on API tagastatud väärtused. Liigu arvule, et näha, milliste päringukoodidega see seotud on.", "data"],
      4: ["GEMINI API VASTUS", "Keelemudel tagastas R-is arvutatud tulemuse põhjal lühikese tõlgenduse.", "data"],
      5: ["KONTROLL TEHTUD", "Statistikaameti arvud ja Gemini tõlgendus on omavahel võrreldud.", "data"]
    };
    setResponseContext(...responseContexts[step]);

    if (step === 1) {
      completeFlowDialog(dialogConfigs[step]);
    }
    if (step === 3) {
      renderSelectedData();
      els.jsonEmpty.hidden = true;
      els.jsonOutput.hidden = false;
      activateTab("jsonPanel");
      els.modelGuide.hidden = false;
      els.stageCard.scrollIntoView({ behavior: "smooth", block: "start" });
      completeFlowDialog(dialogConfigs[step]);
    }
    if (step === 4) {
      completeFlowDialog(dialogConfigs[step]);
    }
    if (step === 5) {
      els.resultEmpty.hidden = true;
      els.resultContent.hidden = false;
      els.practiceSuite.classList.remove("locked");
      els.practiceSuite.removeAttribute("aria-disabled");
      activateTab("resultPanel");
    }

    completed = Math.max(completed, step);
    button.querySelector("span").textContent = completedLabels[step - 1];
    updateProgress();
    running = false;
    els.nextLesson.disabled = step === TOTAL_STEPS;
    renderDots();

    if (step < TOTAL_STEPS) {
      await wait(420);
      showStep(step + 1);
    } else {
      await wait(500);
      els.practiceSuite.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    syncHeight();
  }

  const plannerFields = [
    "useCaseInput",
    "environmentInput",
    "triggerInput",
    "sourceInput",
    "sensitivityInput",
    "aiRoleInput",
    "modelInput",
    "formatInput",
    "visualInput",
    "controlInput",
    "fallbackInput"
  ];

  const scenarioVisuals = {
    statistics: {
      title: "Keskmise brutopalga muutus",
      metric: "+11,8%",
      detail: "2024 II kv → 2026 II kv",
      bars: [62, 76, 91],
      labels: ["2024", "2025", "2026"],
      rows: [["2024 II kv", "2 007 €"], ["2025 II kv", "2 126 €"], ["2026 II kv", "2 243 €"]],
      message: "Palgamuutuse selgitus ootab sisulist kontrolli.",
      summary: "Keskmine brutokuupalk suurenes kahe aastaga 236 euro ehk 11,8%. Andmed ei näita muutuse põhjust.",
      json: { change_eur: 236, change_pct: 11.8, review: "required" }
    },
    survey: {
      title: "Vastuste teemad",
      metric: "4 teemat",
      detail: "128 avatud vastust",
      bars: [84, 63, 47],
      labels: ["Teenindus", "Hind", "Tarne"],
      rows: [["Teenindus", "46"], ["Hind", "35"], ["Tarne", "27"]],
      message: "Uued teemad ja erandid ootavad ülevaatamist.",
      summary: "AI koondas vastused nelja teemasse. Haruldased ja ebaselged vastused jäid inimese kontrolljärjekorda.",
      json: { themes: 4, responses: 128, exceptions: 20 }
    },
    documents: {
      title: "Eraldatud väljad",
      metric: "23 välja",
      detail: "12 dokumenti",
      bars: [92, 81, 68],
      labels: ["Nimi", "Kuupäev", "Summa"],
      rows: [["Nimi", "12/12"], ["Kuupäev", "11/12"], ["Summa", "10/12"]],
      message: "Kahe dokumendi väljad vajavad käsitsi kontrolli.",
      summary: "Dokumentidest eraldati valitud väljad. Madala kindlusega väärtused suunati inimesele.",
      json: { documents: 12, extracted_fields: 23, review_items: 2 }
    },
    support: {
      title: "Päringute suunamine",
      metric: "87%",
      detail: "automaatselt liigitatud",
      bars: [87, 72, 58],
      labels: ["Arveldus", "Tehniline", "Muu"],
      rows: [["Arveldus", "42"], ["Tehniline", "31"], ["Muu", "15"]],
      message: "11 ebaselget päringut ootavad teenindaja otsust.",
      summary: "Enamik päringuid sai esialgse kategooria. Ebaselged juhtumid jäid inimesele.",
      json: { classified_pct: 87, manual_queue: 11, status: "review" }
    },
    meetings: {
      title: "Koosoleku tegevused",
      metric: "6 tegevust",
      detail: "3 vastutajat",
      bars: [78, 62, 46],
      labels: ["Selge", "Tähtaeg", "Omanik"],
      rows: [["Tegevused", "6"], ["Tähtajad", "5"], ["Vastutajad", "3"]],
      message: "Koosoleku kokkuvõte ootab osaleja kinnitust.",
      summary: "Märkmetest leiti kuus tegevust. Enne jagamist kontrollib koosoleku omanik vastutajad ja tähtajad.",
      json: { actions: 6, owners: 3, approval: "pending" }
    },
    content: {
      title: "Tootekirjelduste mustandid",
      metric: "12 mustandit",
      detail: "avaldamata",
      bars: [82, 69, 54],
      labels: ["Valmis", "Kontroll", "Täiendus"],
      rows: [["Valmis", "7"], ["Kontrollis", "3"], ["Täiendada", "2"]],
      message: "Mustandid ootavad tooteomaniku heakskiitu.",
      summary: "AI koostas tooteandmetest mustandid. Faktid ja toon kontrollitakse enne avaldamist.",
      json: { drafts: 12, approved: 0, publish: false }
    },
    other: {
      title: "Töövoo tulemus",
      metric: "Valmis",
      detail: "ootab kontrolli",
      bars: [74, 61, 49],
      labels: ["Sisend", "AI", "Kontroll"],
      rows: [["Sisend", "Saadud"], ["AI", "Töödeldud"], ["Kontroll", "Ootel"]],
      message: "Tulemus on loodud ja ootab vastutaja kontrolli.",
      summary: "AI täitis piiratud ülesande. Tulemust ei kasutata enne kokkulepitud inimkontrolli.",
      json: { result: "ready", human_review: true }
    }
  };

  const plannerPresets = {
    statistics: {
      name: "Statistika selgitaja",
      values: { useCaseInput: "statistics", environmentInput: "r", triggerInput: "button", sourceInput: "statistics-api", sensitivityInput: "public", aiRoleInput: "explain", modelInput: "gemini", formatInput: "json", visualInput: "chart", controlInput: "facts", fallbackInput: "retry" }
    },
    survey: {
      name: "Tagasiside teemastaja",
      values: { useCaseInput: "survey", environmentInput: "automation", triggerInput: "form", sourceInput: "form", sensitivityInput: "personal", aiRoleInput: "classify", modelInput: "azure", formatInput: "schema", visualInput: "table", controlInput: "exceptions", fallbackInput: "queue" }
    },
    documents: {
      name: "Dokumendiväljade eraldaja",
      values: { useCaseInput: "documents", environmentInput: "python", triggerInput: "batch", sourceInput: "documents", sensitivityInput: "internal", aiRoleInput: "extract", modelInput: "local", formatInput: "schema", visualInput: "json", controlInput: "approve", fallbackInput: "manual" }
    }
  };

  let activePlannerPreset = "";

  function plannerValue(id) {
    return $(`#${id}`).value.trim();
  }

  function plannerLabel(id, fallback) {
    const select = $(`#${id}`);
    return select.value ? select.selectedOptions[0].textContent.trim() : fallback;
  }

  function setDecisionCheck(id, state, text) {
    const item = $(`#${id}`);
    item.className = state;
    item.textContent = `${state === "good" ? "✓" : state === "warn" ? "!" : "○"} ${text}`;
  }

  function updateQuality(values) {
    const clarity = (values.useCaseInput ? 5 : 0) + (values.aiRoleInput ? 8 : 0) + (values.formatInput ? 6 : 0) + (values.visualInput ? 6 : 0);
    let privacyFit = 0;
    if (values.sensitivityInput === "public") privacyFit = 10;
    if (values.sensitivityInput === "internal") privacyFit = ["local", "azure"].includes(values.modelInput) ? 8 : 5;
    if (values.sensitivityInput === "personal") privacyFit = ["local", "azure"].includes(values.modelInput) ? 6 : 2;
    if (values.sensitivityInput === "sensitive") privacyFit = values.modelInput === "local" ? 4 : 0;
    const privacy = (values.sourceInput ? 5 : 0) + (values.sensitivityInput ? 5 : 0) + (values.modelInput ? 5 : 0) + privacyFit;
    const strongControl = ["approve", "facts", "owner"].includes(values.controlInput);
    const control = (values.controlInput ? 10 : 0) + (values.formatInput ? 5 : 0) + (strongControl ? 7 : values.controlInput ? 5 : 0) + (values.modelInput ? 3 : 0);
    const reliability = (values.fallbackInput ? 10 : 0) + (values.triggerInput ? 5 : 0) + (values.environmentInput ? 5 : 0) + (values.modelInput ? 5 : 0);
    const dimensions = { clarity, privacy, control, reliability };
    Object.entries(dimensions).forEach(([key, score]) => {
      $(`#${key}Score`).textContent = String(score);
      $(`#${key}Bar`).style.width = `${score * 4}%`;
    });
    const total = Object.values(dimensions).reduce((sum, score) => sum + score, 0);
    const scoreElement = $("#qualityScore");
    scoreElement.textContent = String(total);
    scoreElement.parentElement.className = `quality-score ${total >= 85 ? "strong" : total >= 55 ? "developing" : "starting"}`;
    scoreElement.parentElement.style.setProperty("--quality", `${total}%`);

    const labels = { clarity: "selgus", privacy: "andmekaitse", control: "kontroll", reliability: "töökindlus" };
    const weakest = Object.entries(dimensions).sort((a, b) => a[1] - b[1])[0][0];
    let hint = `Järgmine arengukoht on ${labels[weakest]}.`;
    if (values.sensitivityInput === "sensitive") hint = "Tundlikud isikuandmed vajavad eraldi õiguslikku ja turbeanalüüsi – kõrge skoor üksi ei anna kasutusluba.";
    else if (total >= 90) hint = "Tugev visand. Katseta nüüd allpool üht tõrkeolukorda ja vaata, kas plaan peab vastu.";
    else if (!values.aiRoleInput) hint = "Sõnasta AI-le üks piiratud tegevus: liigita, eralda, võta kokku või selgita.";
    $("#qualityHint").textContent = hint;
    return total;
  }

  function updateRequestBlueprint(values) {
    const endpoints = {
      gemini: ["POST /v1beta/models/gemini:generateContent", "x-goog-api-key: [REDACTED]"],
      openai: ["POST /v1/responses", "Authorization: Bearer [REDACTED]"],
      anthropic: ["POST /v1/messages", "x-api-key: [REDACTED]"],
      azure: ["POST /openai/deployments/{deployment}/responses", "api-key: [REDACTED]"],
      local: ["POST /v1/chat/completions", "Authorization: Bearer [LOCAL TOKEN]"]
    };
    const [endpoint, authorization] = endpoints[values.modelInput] || ["POST [vali mudel või API]", "Authorization: [REDACTED]"];
    const requestBody = {
      model: values.modelInput || "vali mudel",
      task: plannerLabel("aiRoleInput", "vali AI piiratud ülesanne"),
      source: plannerLabel("sourceInput", "vali andmeallikas"),
      response_format: values.formatInput || "vali vorming",
      human_review: plannerLabel("controlInput", "vali inimkontroll")
    };
    $("#plannerRequest").textContent = `${endpoint}\nContent-Type: application/json\n${authorization}\n\n${JSON.stringify(requestBody, null, 2)}`;
  }

  function renderStressTest(values) {
    const scenario = $("#stressInput").value;
    const result = $("#stressResult");
    let state = "pending";
    let title = "Vali testolukord";
    let text = "Siin näed, kas kavandatud kontroll ja varuplaan aitavad.";

    if (scenario === "rate-limit") {
      const ready = ["retry", "queue", "cache"].includes(values.fallbackInput);
      state = ready ? "good" : "warn";
      title = ready ? "Plaan peab vastu" : "Lisa tehniline varuplaan";
      text = ready ? "Valitud tõrkeplaan väldib päringu lõputut kordamist ja säilitab töövoo kontrolli." : "429 vastus vajab piiratud korduskatseid, järjekorda või viimast kontrollitud tulemust.";
    } else if (scenario === "invalid-output") {
      const structured = values.formatInput === "schema";
      const reviewed = ["approve", "facts", "owner", "exceptions"].includes(values.controlInput);
      state = structured && reviewed ? "good" : "warn";
      title = state === "good" ? "Viga avastatakse enne kasutamist" : "Vastus võib märkamatult edasi liikuda";
      text = state === "good" ? "JSON-skeem tuvastab vormivea ja inimkontroll püüab kinni sisulise vea." : "Kasuta struktureeritud skeemi ning määra, kes vigase või puuduliku vastuse üle vaatab.";
    } else if (scenario === "personal-data") {
      const declared = ["personal", "sensitive"].includes(values.sensitivityInput);
      const protectedModel = ["local", "azure"].includes(values.modelInput);
      state = declared && protectedModel && Boolean(values.controlInput) ? "good" : "warn";
      title = state === "good" ? "Risk on vähemalt nähtav" : "Peata saatmine ja hinda andmekaitset";
      text = state === "good" ? "Tundlikkus, teenusevalik ja inimkontroll on kavandis nähtavad. Enne päriskasutust kontrolli siiski õiguslikku alust ja lepinguid." : "Ootamatu isikuinfo ei tohi automaatselt mudelile liikuda. Lisa tuvastus, minimeerimine ja lubatud teenus.";
    } else if (scenario === "model-outage") {
      const ready = ["manual", "queue", "cache"].includes(values.fallbackInput);
      state = ready ? "good" : "warn";
      title = ready ? "Töö saab kontrollitult jätkuda" : "Töövoog jääb seisma";
      text = ready ? "Valitud varuplaan säilitab töö, kuni mudeliteenus taastub." : "Pelgalt veateavitus või korduskatse ei pruugi piisata. Määra käsitsi töö, järjekord või kontrollitud vahetulemus.";
    } else if (scenario === "low-confidence") {
      const reviewed = ["approve", "facts", "exceptions", "owner"].includes(values.controlInput);
      state = reviewed ? "good" : "warn";
      title = reviewed ? "Ebakindel tulemus jõuab inimeseni" : "Madal kindlus vajab eskaleerimist";
      text = reviewed ? "Valitud kontroll sobib ebakindlate juhtumite peatamiseks või ülevaatamiseks." : "Lisa reegel, mis suunab madala kindlusega vastused inimesele, mitte automaatsele kasutamisele.";
    }

    result.className = `stress-result ${state}`;
    result.querySelector("span").textContent = state === "good" ? "✓" : state === "warn" ? "!" : "○";
    result.querySelector("b").textContent = title;
    result.querySelector("p").textContent = text;
  }

  function renderOutputVisual(values, built = false) {
    const canvas = $("#outputCanvas");
    const scenario = scenarioVisuals[values.useCaseInput] || scenarioVisuals.other;
    const visual = values.visualInput;
    canvas.className = `output-canvas ${visual ? `visual-${visual}` : "is-empty"}${built ? " is-built" : ""}`;
    $("#visualKind").textContent = plannerLabel("visualInput", "Vali vaade");
    $("#visualFormat").textContent = plannerLabel("formatInput", "Vorming valimata");
    $("#visualModel").textContent = plannerLabel("modelInput", "Mudel valimata");

    if (!values.useCaseInput || !visual) {
      canvas.innerHTML = '<div class="output-empty"><span aria-hidden="true">◇</span><b>Visuaal tekib siia</b><small>Vali kasutusjuht ja tulemuse visuaal.</small></div>';
      return;
    }

    if (visual === "kpi") {
      canvas.innerHTML = `<div class="kpi-visual"><span>${scenario.title}</span><strong>${scenario.metric}</strong><small>${scenario.detail}</small><em>Kontrollimata AI-väljund</em></div>`;
    } else if (visual === "chart") {
      canvas.innerHTML = `<div class="chart-visual"><div class="visual-title"><b>${scenario.title}</b><span>${scenario.detail}</span></div><div class="mini-bars">${scenario.bars.map((height, index) => `<div><strong>${height}</strong><i style="--mini-height:${height}%"></i><span>${scenario.labels[index]}</span></div>`).join("")}</div></div>`;
    } else if (visual === "table") {
      canvas.innerHTML = `<div class="table-visual"><b>${scenario.title}</b><table><thead><tr><th>Rühm</th><th>Väärtus</th></tr></thead><tbody>${scenario.rows.map((row) => `<tr><td>${row[0]}</td><td>${row[1]}</td></tr>`).join("")}</tbody></table></div>`;
    } else if (visual === "notification") {
      canvas.innerHTML = `<div class="notification-visual"><span aria-hidden="true">AI</span><div><small>TULEMUS ON VALMIS</small><b>${scenario.message}</b><p>${scenario.detail}</p></div></div>`;
    } else if (visual === "summary") {
      canvas.innerHTML = `<div class="summary-visual"><small>AI KOKKUVÕTE</small><h5>${scenario.title}</h5><p>${scenario.summary}</p><span>Vajab inimkontrolli</span></div>`;
    } else {
      canvas.innerHTML = `<div class="json-visual"><div><span></span><span></span><span></span><b>result.json</b></div><pre>${JSON.stringify(scenario.json, null, 2)}</pre></div>`;
    }
  }

  function updatePlannerPreview(showResult = false) {
    const values = Object.fromEntries(plannerFields.map((id) => [id, plannerValue(id)]));
    const completedFields = Object.values(values).filter(Boolean).length;
    $("#plannerState").textContent = `${completedFields} / ${plannerFields.length} valikut`;
    $("#previewTrigger").textContent = [plannerLabel("useCaseInput", "Kasutusjuht valimata"), plannerLabel("triggerInput", "käivitus valimata"), plannerLabel("environmentInput", "keskkond valimata")].join(" · ");
    $("#previewSource").textContent = [plannerLabel("sourceInput", "Allikas valimata"), plannerLabel("sensitivityInput", "tundlikkus valimata")].join(" · ");
    $("#previewAi").textContent = [plannerLabel("modelInput", "Mudel valimata"), plannerLabel("aiRoleInput", "roll valimata")].join(" · ");
    $("#previewOutput").textContent = [plannerLabel("formatInput", "Vorming valimata"), plannerLabel("visualInput", "vaade valimata")].join(" · ");
    $("#previewControl").textContent = [plannerLabel("controlInput", "Kontroll valimata"), plannerLabel("fallbackInput", "varuplaan valimata")].join(" · ");

    renderOutputVisual(values, showResult);
    const totalScore = updateQuality(values);
    updateRequestBlueprint(values);
    renderStressTest(values);
    const sensitive = values.sensitivityInput === "personal" || values.sensitivityInput === "sensitive";
    setDecisionCheck("privacyCheck", values.sensitivityInput ? (sensitive ? "warn" : "good") : "pending", sensitive ? "Isikuandmed vajavad õiguslikku alust ja minimaalset andmehulka" : values.sensitivityInput ? "Andmete tundlikkus on määratud" : "Määra andmete tundlikkus");
    setDecisionCheck("structureCheck", values.formatInput ? "good" : "pending", values.formatInput ? "API vastuse vorming on määratud" : "Määra vastuse vorming");
    setDecisionCheck("reviewCheck", values.controlInput ? "good" : "pending", values.controlInput ? "Inimkontroll on töövoos nähtav" : "Määra inimkontroll");
    setDecisionCheck("resilienceCheck", values.fallbackInput ? "good" : "pending", values.fallbackInput ? "Tõrkeplaan on olemas" : "Määra tõrkeplaan");

    const summary = $("#plannerSummary");
    summary.classList.toggle("good", showResult && completedFields === plannerFields.length);
    if (!showResult && activePlannerPreset) {
      summary.textContent = `Näidis „${plannerPresets[activePlannerPreset].name}” on laaditud. Muuda vähemalt üht otsust ning jälgi, kuidas skoor, API-päring ja tõrketest reageerivad.`;
    } else if (!showResult) {
      summary.textContent = "Tee valikud. Skeem ja tulemuse visuaal uuenevad automaatselt; nupuga saad valmis töövoo kinnitada.";
    } else if (completedFields === plannerFields.length) {
      summary.textContent = `Valmis. Valmidusskoor on ${totalScore}/100. ${plannerLabel("environmentInput", "Valitud keskkond")} käivitab töövoo: ${plannerLabel("sourceInput", "andmeallikas")} → ${plannerLabel("modelInput", "AI API")} → ${plannerLabel("visualInput", "tulemuse vaade")} → ${plannerLabel("controlInput", "inimkontroll")}.`;
    } else {
      summary.textContent = `Visand on pooleli: tee veel ${plannerFields.length - completedFields} valikut. Terviklik töövoog vajab sisendit, piiratud AI rolli, väljundit, inimkontrolli ja tõrkeplaani.`;
    }
    syncHeight();
  }

  function resetPlanner() {
    $("#workflowPlanner").reset();
    $("#stressInput").value = "";
    activePlannerPreset = "";
    $$('[data-planner-preset]').forEach((button) => button.classList.remove("active"));
    updatePlannerPreview(false);
  }

  function applyPlannerPreset(key) {
    const preset = plannerPresets[key];
    if (!preset) return;
    activePlannerPreset = key;
    Object.entries(preset.values).forEach(([id, value]) => { $(`#${id}`).value = value; });
    $$('[data-planner-preset]').forEach((button) => button.classList.toggle("active", button.dataset.plannerPreset === key));
    updatePlannerPreview(false);
    $("#workflowPlanner").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function reset() {
    currentStep = 1;
    completed = 0;
    running = false;
    if (els.flowDialog.open) els.flowDialog.close();
    els.selectionAction.dataset.run = "2";
    els.selectionAction.classList.remove("orange");
    $$("[data-run]").forEach((button) => {
      button.disabled = false;
      button.querySelector("span").textContent = runLabels[Number(button.dataset.run) - 1];
    });
    els.consoleOutput.textContent = JSON.stringify({ status: "Päringut pole veel saadetud" }, null, 2);
    els.terminalTitle.textContent = "vastus.json";
    els.consoleBadge.textContent = "—";
    els.consoleBadge.className = "neutral";
    setResponseContext("API VASTUS", "Pärast päringu saatmist näed siin teenuselt saadud vastust.");
    els.statusChip.className = "status-chip neutral";
    els.statusText.textContent = "Päringut pole veel saadetud";
    els.stageCard.classList.add("awaiting-response");
    els.stageCard.setAttribute("aria-disabled", "true");
    els.jsonEmpty.hidden = false;
    els.jsonOutput.hidden = true;
    els.flowPackage.classList.remove("active");
    els.flowApi.classList.remove("active");
    els.flowMap.classList.remove("sending", "returning");
    els.resultEmpty.hidden = false;
    els.resultContent.hidden = true;
    els.modelGuide.hidden = true;
    els.practiceSuite.classList.add("locked");
    els.practiceSuite.setAttribute("aria-disabled", "true");
    els.indicatorSelect.selectedIndex = 0;
    els.activitySelect.selectedIndex = 0;
    $$('input[type="checkbox"]', els.periodOptions).forEach((input) => {
      input.checked = defaultPeriods.has(input.value);
    });
    updateRequestPreview();
    resetPlanner();
    activateTab("consolePanel");
    updateProgress();
    showStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $$("[data-run]").forEach((button) => button.addEventListener("click", () => runStep(Number(button.dataset.run))));
  els.selectionFields.addEventListener("change", updateRequestPreview);
  ["pointerover", "focusin"].forEach((type) => els.postResponseOutput.addEventListener(type, (event) => {
    const value = event.target.closest(".response-value");
    if (value) toggleResultLinks(value.dataset.resultIndex, true);
  }));
  ["pointerout", "focusout"].forEach((type) => els.postResponseOutput.addEventListener(type, (event) => {
    const value = event.target.closest(".response-value");
    if (value) toggleResultLinks(value.dataset.resultIndex, false);
  }));
  $$(".step").forEach((button) => button.addEventListener("click", () => showStep(Number(button.dataset.step), true)));
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.panel)));
  els.prevLesson.addEventListener("click", () => showStep(currentStep - 1, true));
  els.nextLesson.addEventListener("click", () => showStep(currentStep + 1, true));
  $("#resetButton").addEventListener("click", reset);
  plannerFields.forEach((id) => $(`#${id}`).addEventListener("change", () => {
    activePlannerPreset = "";
    $$('[data-planner-preset]').forEach((button) => button.classList.remove("active"));
    updatePlannerPreview(false);
  }));
  $$('[data-planner-preset]').forEach((button) => button.addEventListener("click", () => applyPlannerPreset(button.dataset.plannerPreset)));
  $("#stressInput").addEventListener("change", () => {
    const values = Object.fromEntries(plannerFields.map((id) => [id, plannerValue(id)]));
    renderStressTest(values);
    syncHeight();
  });
  $("#buildWorkflow").addEventListener("click", () => updatePlannerPreview(true));
  $("#clearWorkflow").addEventListener("click", resetPlanner);
  els.modelGuide.addEventListener("click", () => {
    const target = $('[data-run="4"]');
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target.focus({ preventScroll: true }), 450);
  });
  els.flowDialogClose.addEventListener("click", () => {
    const dialogStep = Number(els.flowDialog.dataset.step || 0);
    els.flowDialog.close();
    if (dialogStep === 4) {
      window.setTimeout(() => alignResponseWithLesson(5), 120);
    } else if (dialogStep === 3 && !els.modelGuide.hidden) {
      window.setTimeout(() => els.stageCard.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } else if (dialogStep === 1) {
      window.setTimeout(() => alignResponseWithLesson(2), 120);
    }
  });
  els.flowDialog.addEventListener("cancel", (event) => {
    if (els.flowDialogClose.disabled) event.preventDefault();
  });
  window.addEventListener("message", (event) => {
    if (event.data?.type === "simfluence:measure" || event.data?.type === "measure") syncHeight();
  });

  const params = new URLSearchParams(location.search);
  if (params.get("embed") === "1" || params.get("embedMode") === "1") document.body.classList.add("embed-mode");
  if ("ResizeObserver" in window) new ResizeObserver(syncHeight).observe(document.body);
  populateSelectionOptions();
  updateRequestPreview();
  updateProgress();
  showStep(1);
  updatePlannerPreview(false);
  window.setTimeout(syncHeight, 100);
})();
