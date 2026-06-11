// Filtert die Bücher-Übersicht nach Person, Rolle und Typ.
// Person + Rolle zusammen wird personenbezogen geprüft (wer hat welche Rolle).
(function () {
  const state = { person: "alle", role: "alle", type: "alle" };
  const cards = Array.from(document.querySelectorAll(".card"));
  const count = document.getElementById("fmeta");

  function apply() {
    let shown = 0;
    cards.forEach((c) => {
      const persons = (c.dataset.persons || "").split(" ").filter(Boolean);
      const roles = (c.dataset.roles || "").split(" ").filter(Boolean);
      const pairs = (c.dataset.pairs || "").split(" ").filter(Boolean);
      const type = c.dataset.type || "";

      let prOk;
      if (state.person === "alle" && state.role === "alle") prOk = true;
      else if (state.person !== "alle" && state.role !== "alle")
        prOk = pairs.includes(state.person + ":" + state.role);
      else if (state.person !== "alle") prOk = persons.includes(state.person);
      else prOk = roles.includes(state.role);

      const ok = prOk && (state.type === "alle" || type === state.type);
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
