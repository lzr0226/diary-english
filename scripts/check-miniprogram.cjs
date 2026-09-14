const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const root = "tencent/miniprogram";
const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
for (const page of app.pages) {
  const js = fs.readFileSync(path.join(root, page + ".js"), "utf8");
  new vm.Script(js, { filename: page + ".js" });
  let definition;
  vm.runInNewContext(js, {
    Page: (v) => {
      definition = v;
    },
    require: () => ({}),
    Date,
    Math,
  });
  const markup = fs.readFileSync(path.join(root, page + ".wxml"), "utf8");
  for (const [, handler] of markup.matchAll(
    /(?:bind\w+|catch\w+)="([A-Za-z]\w*)"/g,
  ))
    if (typeof definition[handler] !== "function")
      throw Error(page + ": missing handler " + handler);
}
for (const tab of app.tabBar.list)
  if (!app.pages.includes(tab.pagePath)) throw Error("Invalid tab route");
new vm.Script(
  fs.readFileSync("tencent/cloudfunctions/diaryApi/index.js", "utf8"),
);
if (!fs.existsSync("tencent/cloudfunctions/diaryApi/core.cjs"))
  throw Error("Build shared core first");
console.log(
  "PASS: " +
    app.pages.length +
    " native pages, JS syntax, WXML event handlers and tab routes. This is not a WeChat DevTools compile or device test.",
);
