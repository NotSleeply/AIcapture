const log = require("fe-logs");
function funLog() {
  log.setMode("error");
  log.setName(".electron-capture-log.txt");
}
module.exports = funLog;
