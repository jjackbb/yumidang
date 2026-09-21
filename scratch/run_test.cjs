const fs = require('fs');
let js = fs.readFileSync('scratch/test.js', 'utf8');

// mock document
global.document = {
  getElementById: () => ({ addEventListener: () => {}, setAttribute: () => {}, classList: { toggle: () => {}, contains: () => false } }),
  addEventListener: () => {},
  querySelector: () => null
};

// expose variables
js = js + `\n global.SCREENS = SCREENS; global.renderGrid = renderGrid; global.renderDetail = renderDetail;`;

try {
  eval(js);
  console.log("Evaluation successful. SCREENS length:", global.SCREENS.length);
  // run all render functions
  global.SCREENS.forEach(screen => {
    screen.states.forEach(stateArr => {
      const c = { id: screen.id, st: stateArr[0] };
      try {
        screen.r(c);
      } catch(e) {
        console.error(`Error rendering ${screen.id} at state ${stateArr[0]}:`, e.stack);
      }
    });
  });
  console.log("All renders successful!");
} catch (e) {
  console.error("Failed!", e.stack);
}
