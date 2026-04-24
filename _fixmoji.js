const fs = require("fs");
const srcPath = "D:/Projects/RMT-GuardTourSystem/app.js";
const outPath = "D:/Projects/RMT-GuardTourSystem/app.convert-test.js";
let src = fs.readFileSync(srcPath, "utf8");
function decode(s){ return Buffer.from(s, "latin1").toString("utf8"); }
let changed = 0;
src = src.replace(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g, (m,q,b)=>{
  if (!b.includes("à")) return m;
  const d = decode(b);
  if (/[\u0000-\u001f]/.test(d)) return m;
  changed++;
  return q + d + q;
});
fs.writeFileSync(outPath, src, "utf8");
console.log("changed", changed);
