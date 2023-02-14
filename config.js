const dotenv = require("dotenv");


if(process.env.MODE != 'production'){
    dotenv.config()
    }


const MODE = process.env.MODE;
const HOST = process.env.HOST;
const DIRSTATIC = process.env.DIRSTATIC;
const DATABASEURL = process.env.DATABASEURL;
const DBPROD = process.env.DBPROD;

module.exports = {MODE, HOST, DIRSTATIC, DATABASEURL, DBPROD}


