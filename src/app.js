// Filtert die Bücher-Übersicht nach Person, Rolle und Typ (UND zwischen den Gruppen).
(function () {
  const state = { person: "alle", role: "alle", type: "alle" };
  const cards = Array.from(document.querySelectorAll(".card"));
  const count = document.getElementById("fmeta");

  function apply() {
    let shown = 0;
    cards.forEach((c) => {
      const persons = (c.dataset.persons || "").split(" ");
      const roles = (c.dataset.roles || "").split(" ");
      const type = c.dataset.type || "";
      const ok =
        (state.person === "alle" || persons.includes(state.person)) &&
        (state.role === "alle" || roles.includes(state.role)) &&
        (state.type === "alle" || type === state.type);
      c.classList.toggle("hidden", !ok);
      if (ok) shown++;
    });
    if (count) count.textContent = shown + (shown === 1 ? " Buch" : " Bücher");
  }

  document.querySelectorAll(".chips").forEach((group) => {
    const dim = group.dataset.dim;
    group.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      state[dim] = chip.dataset.value;
      group.querySelectorAll(".chip").forEach((x) =>
        x.setAttribute("aria-pressed", String(x === chip))
      );
      apply();
    });
  });

  apply();
})();
