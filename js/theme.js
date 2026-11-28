/* Runs in <head> before the page draws (a classic script, not a module), so a Light or Dark choice
   from Settings never flashes the other theme first. Settings changes it later with the same rules. */
(function () {
  var t = "system";
  try { t = JSON.parse(localStorage.getItem("tangent.theme") || '"system"'); } catch (e) {}
  if (t !== "light" && t !== "dark") return;
  document.documentElement.setAttribute("data-theme", t);
  var bg = t === "dark" ? "#101012" : "#fbf9f6";
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < metas.length; i++) metas[i].setAttribute("content", bg);
})();
