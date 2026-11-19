(() => {
  "use strict";
  const options = {
    api1: { number: 1, label: "API 1 · Saada päring. Loe vastust." },
    api2: { number: 2, label: "API 2 · Töötle API-andmeid RStudios" },
    api3: { number: 3, label: "API 3 · Ühenda tehisaru API oma rakendusega" }
  };
  const radios = [...document.querySelectorAll('input[name="api-version"]')];
  const selectedLabel = document.querySelector("#selectedLabel");
  const startButton = document.querySelector("#startButton");

  function updateSelection(value) {
    const selected = options[value] || options.api1;
    selectedLabel.textContent = selected.label;
    startButton.href = `./${value}/`;
    startButton.querySelector("span").textContent = `Alusta ${selected.number}. praktikumist`;
  }

  radios.forEach((radio) => radio.addEventListener("change", () => updateSelection(radio.value)));
  updateSelection(radios.find((radio) => radio.checked)?.value || "api1");
})();
