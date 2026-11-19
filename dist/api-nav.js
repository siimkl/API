(() => {
  "use strict";
  const select = document.querySelector(".api-version-select");
  if (!select) return;
  select.addEventListener("change", () => {
    window.location.assign(select.value);
  });
})();
