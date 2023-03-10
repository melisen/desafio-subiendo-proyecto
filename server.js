
const express = require("express")

const session = require("express-session");
const {Server: HTTPServer} = require("http")
const {Server: IOServer} = require("socket.io");
const {faker} = require("@faker-js/faker");
const  {mongoose}  = require("mongoose");
const handlebars = require('express-handlebars');
const routes = require("./routes");
const routeInfo = require("./routeInfo");
const routeFork = require("./routeFork");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const Usuarios = require("./models/usuarios");
const {normalizr, normalize, schema, denormalize} = require("normalizr");
const bcrypt = require("bcrypt");
const parseArgs = require("minimist");
const compression = require('compression');
const logger = require("./winston-logger");


const dotenv = require("dotenv");


if(process.env.MODE != 'production'){
    dotenv.config()
    }


const MODE = process.env.MODE;
const HOST = process.env.HOST;
const DIRSTATIC = process.env.DIRSTATIC;
const DATABASEURL = process.env.DATABASEURL;
const DBPROD = process.env.DBPROD;





const argsPORT = parseArgs(process.argv.slice(2));
const PORT = process.argv[2];



const app = express();



//app.use(compression());

const httpServer = new HTTPServer(app)
const io = new IOServer(httpServer)

app.use(express.urlencoded({extended: true}))
app.use(express.json());


//PROXY
//app.enable("trust proxy");
//FORK DE CHILD PROCESS
app.get('/api/randoms', routeFork.getRandoms);




//PERSISTENCIA PRODUCTOS
const ContenedorMongoDB = require("./ContenedorMongoDB.js");
const ProdModel = require("./models/productos")
const Productos = new ContenedorMongoDB(DBPROD, ProdModel, "productosDB", "prodcollection" );
async function conectarMongo(){
  await Productos.connectMG()
} 

// PERSISTENCIA MENSAJES
const ContenedorFS =  require('./contenedor-fs.js');
const mensajesFS = new ContenedorFS('./mensajes.json')


//app.use(express.static(config.DIRSTATIC));
//app.use(express.static(path.join(__dirname, 'public'))); 

//*HANDLEBARS
app.set('views', './views/')
 const hbs = handlebars.engine({
  defaultLayout: "index.hbs",
   extname: "hbs",
   layoutsDir: "./views/layouts/",
   partialsDir: "./views/partials"
 });
 app.engine("hbs", hbs);
 app.set("view engine", "hbs");


 const redis = require("redis");
const client = redis.createClient({
  legacyMode: true,
});
client
  .connect()
  .catch((e) => {
    logger.log("error", "cannot connect to Redis")
  });
const RedisStore = require("connect-redis")(session);

//MONGO USUARIOS
mongoose
  .connect(DATABASEURL)
  .catch((e) => {
    logger.log("error", "cannot connect to Mongo");
    ;
  });
 

function isValidPassword(user, password) {
  return bcrypt.compareSync(password, user.password);
}

function createHash(password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(10), null);
}

passport.use(
  "login",
  new LocalStrategy((username, password, done) => {
    Usuarios.findOne({ username }, (err, user) => {
      if (err) return done(err);

      if (!user) {
        console.log("User Not Found with username " + username);
        return done(null, false);
      }

      if (!isValidPassword(user, password)) {
        console.log("Invalid Password");
        return done(null, false);
      }

      return done(null, user);
    });
  })
);

passport.use(
  "signup",
  new LocalStrategy(
    {
      passReqToCallback: true,
    },
    (req, username, password, done) => {
      Usuarios.findOne({ username: username }, function (err, user) {
        if (err) {
          console.log("Error in SignUp: " + err);
          return done(err);
        }

        if (user) {
          console.log("User already exists");
          return done(null, false);
        }

        const newUser = {
          username: username,
          password: createHash(password),
        };
        Usuarios.create(newUser, (err, userWithId) => {
          if (err) {
            console.log("Error in Saving user in Usuarios: " + err);
            return done(err);
          }

          console.log(user);
          console.log("User Registration succesful");
          return done(null, userWithId);
        });
      });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser((id, done) => {
  Usuarios.findById(id, done);
});

//SESSION
app.use(
  session({
    store: new RedisStore({ host: "localhost", port: 6379, client, ttl: 300 }),
    secret: "keyboard cat",
    cookie: {
      httpOnly: false,
      secure: false,
      maxAge: 600000, //10 min
    },
    rolling: true,
    resave: true,
    saveUninitialized: false,
  })
);


app.use(passport.initialize());
app.use(passport.session());


//crear productos random para "/productos-test"
let listaProductos = [];
function crearProductosRandom(){
    for(let i=0; i<5; i++){
        listaProductos.push( 
            {
                title: faker.commerce.product().toString(),
                price: faker.commerce.price(100, 200, 0, '$').toString(),
                thumbnail: faker.image.imageUrl(100, 100).toString()
            } 
        )
    }
    return listaProductos;
}




//RUTAS

app.get("/", 
routes.getRoot,
 )

//LOGIN
app.get("/login", routes.getLogin);
app.post("/login",
  passport.authenticate("login", { failureRedirect: "/faillogin" }),
  routes.postLogin
);
app.get("/faillogin", routes.getFaillogin);

//SIGNUP
app.get("/signup", routes.getSignup);
app.post("/signup",
  passport.authenticate("signup", { failureRedirect: "/failsignup" }),
  routes.postSignup
);
app.get("/failsignup", routes.getFailsignup);


//AUTH
  function auth(req, res, next) {
    if (req.isAuthenticated()) {
      next();
    } else {
      console.log("error en auth")
      res.redirect("/login");
    }
  }

  app.get("/api/productos", auth, async (req, res)=>{
    const { username, password } = req.user;
    const user = { username, password };
    try{
        const listaProductos = await Productos.listarTodos();
        if(listaProductos){
            res.render("vista-productos", {productos: listaProductos, user});
        }else{
          logger.log("error", "error al requerir productos de la DB");
          res.render("error")
        }
    }
    catch(err){
      logger.log("error", "/api/productos -  GET")
    }
  });

  app.get('/api/productos-test', auth, async (req, res)=>{
    logger.log("info", "/api/productos-test  -   GET")
    res.render("productos-test")
})

//LOGOUT
app.get("/logout", routes.getLogout);


//INFO OBJETO PROCESS
app.get('/info', routeInfo.getInfo);



//FAIL ROUTE
app.get("*", routes.failRoute);

//NORMALIZACION
function normlizarChat(messages){
            //esquemas para normalizacion
            const author = new schema.Entity('author',{}, { idAttribute: 'email' });

            const message = new schema.Entity('message', 
            { author: author }, 
            { idAttribute: "id" })

            const schemaMessages = new schema.Entity("messages", { messages:[message] })
    
            const dataNormalizada = normalize({ id: "messages", messages }, schemaMessages)
        

 return dataNormalizada
}

//*WEBSOCKET PRODUCTOS Y MENSAJES
//'1) conexi??n del lado del servidor
io.on('connection', async (socket) =>{
        const listaMensajes = await mensajesFS.getAll();
        
        //const normalizado = normlizarChat(listaMensajes)
        //console.log("normalizado", JSON.stringify(normalizado, null, 4));
        //const desnormalizado = denormalize(normalizado.result, TodosLosMensajesSchema, normalizado.entities);
        //console.log("desnormalizado", desnormalizado);
        socket.emit("mensajes", listaMensajes)
        socket.emit("productos", await Productos.listarTodos())
        socket.emit("prod-test", crearProductosRandom())


                socket.on('new_prod', async (data) =>{
                    try{
                      await Productos.guardar(data)
                      const listaActualizada = await Productos.listarTodos();
                      logger.log("info", "producto guardado")
                      io.sockets.emit('productos', listaActualizada)
                    }
                    catch{
                      logger.log("error", "error al escuchar productos");
                    }
                   
                })                
                socket.on('new_msg', async (data)=>{
                  try{
                    await mensajesFS.save(data);
                    const listaMensajes = await mensajesFS.getAll();
                    io.sockets.emit('mensajes', listaMensajes) 
                  }
                  catch{
                    logger.log("error", "error al escuchar mensajes");
                  }
                               
                })          
})
//EN TERMINAL: $ node server.js --port *numero del puerto* --> para pasarlo como argumento de minimist
        httpServer.listen(argsPORT.port || 8080, ()=>{
            console.log('servidor de express escuchando el puerto ', argsPORT.port)
        })

