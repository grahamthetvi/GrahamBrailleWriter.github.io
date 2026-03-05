
const fs = require('fs');

async function test() {
  const code = fs.readFileSync('public/wasm/easy-api.js', 'utf8');
  // mock capi and self
  global.self = {};
  global.capi = {
    _malloc: () => 10,
    stringToUTF16: () => {},
    setValue: () => {},
    ccall: () => 1,
    getValue: () => 5,
    _free: () => {},
    HEAP16: new Int16Array(100)
  };
  global.liblouis = {};
  
  eval(code);
  
  try {
    const res = global.liblouis.translateString("en-ueb-g2.ctb", "hello");
    console.log("Success:", res);
  } catch(e) {
    console.log("Error:", e.message);
  }
}
test();
