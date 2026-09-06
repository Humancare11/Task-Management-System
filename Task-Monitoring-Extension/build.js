// Minimal bundler: MV3 content scripts can't require(), so concatenate
// detector.js (as a plain object literal `detector`) ahead of content.js.
// No third-party deps.

"use strict";

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src");
const OUT = path.join(__dirname, "dist");

function read(f) {
    return fs.readFileSync(path.join(SRC, f), "utf8");
}

fs.mkdirSync(OUT, { recursive: true });

// detector.js ends with `module.exports = { ... };` — strip that and the
// `"use strict";` and expose the object as `const detector = (function(){ ... })()`.
let detector = read("detector.js");
detector = detector.replace(/^\s*"use strict";\s*$/m, "");
detector = detector.replace(
    /module\.exports\s*=\s*(\{[\s\S]*?\});\s*$/,
    "return $1;",
);

const contentBundle = [
    '"use strict";',
    "const detector = (function () {",
    detector,
    "})();",
    "",
    read("content.js"),
].join("\n");

fs.writeFileSync(path.join(OUT, "content.bundle.js"), contentBundle);
fs.copyFileSync(path.join(SRC, "background.js"), path.join(OUT, "background.js"));
fs.copyFileSync(path.join(__dirname, "manifest.json"), path.join(OUT, "manifest.json"));

console.log("Built dist/ — load it unpacked, or zip it for the Web Store / policy.");
