const fs = require('fs');

async function test() {
  const code = fs.readFileSync('public/wasm/easy-api.js', 'utf8');
  // mock capi and self
  global.self = {};
  global.capi = {
    _malloc: () => 10,
    stringToUTF16: () => { },
    setValue: () => { },
    ccall: (name, ret, argTypes, args) => {
      console.log('ccall invoked:', name, args);
      return 1; // success
    },
    getValue: () => 0,
    _free: () => { },
    HEAP16: new Int16Array(100),
    Runtime: {
      addFunction: (fn) => {
        return 12345;
      },
      removeFunction: () => { }
    },
    FS: { lookup: () => { } }
  };
  global.liblouis = {};
  global.isNode = false;

  try {
    eval(code);

    // Simulate double-init:
    global.liblouis.setLiblouisBuild(global.capi);
    console.log("First init done. _log_callback_fn_pointer =", global.liblouis._log_callback_fn_pointer, ", _log_callback_js_fn =", typeof global.liblouis._log_callback_js_fn);

    global.liblouis.setLiblouisBuild(global.capi);
    console.log("Second init done. _log_callback_fn_pointer =", global.liblouis._log_callback_fn_pointer, ", _log_callback_js_fn =", typeof global.liblouis._log_callback_js_fn);

    const res = global.liblouis.translateString("en-ueb-g2.ctb", "hello");
    console.log("translateString returned successfully:", typeof res);
  } catch (e) {
    console.error("Caught error:", e.stack);
  }
}
test();
