const fs=require("fs");
const srcPath="D:/Projects/RMT-GuardTourSystem/app.js";
const outPath="D:/Projects/RMT-GuardTourSystem/app.convert-test3.js";
let src=fs.readFileSync(srcPath,"utf8");
let changed=0;
function dec(x){try{return Buffer.from(x,"latin1").toString("utf8")}catch{return x}}
src=src.replace(/[àÃÂ][\u0080-\u00FF]+/g,(m)=>{changed++; return dec(m);});
fs.writeFileSync(outPath,src,"utf8");
console.log('changed',changed);
