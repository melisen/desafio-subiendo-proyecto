const logger = require("./winston-logger");



const nombrePlataforma = process.platform;
const verNode = process.version;
const memoriaRSS = process.memoryUsage().rss;
const pathEjec = process.execPath;
const processId = process.pid;
const carpetaProyecto = process.cwd();





function getInfo(req, res){
    logger.log("info", "/info  -  GET")
    console.log(nombrePlataforma, verNode, memoriaRSS, pathEjec, processId, carpetaProyecto)
    res.render("info", { nombrePlataforma, verNode, memoriaRSS, pathEjec, processId, carpetaProyecto });
}

module.exports = {
    getInfo  
}

