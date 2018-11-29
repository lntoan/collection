require('dotenv').config();
var express = require('express'),
  app = express(),
  port = process.env.PORT || 3000,
  mongoose = require('mongoose'),
  Contract = require('./api/models/contractModel'),
  Field = require('./api/models/fieldModel'),
  DocumentCode = require('./api/models/documentModel'),
  router = express.Router(),
  bodyParser = require('body-parser');

// mongoose instance connection url connection
mongoose.Promise = global.Promise;
// mongoose.connect('mongodb://localhost/lendizcollection',{useNewUrlParser: true});
mongoose.connect('mongodb://' + process.env.DB_USER + ':' + process.env.DB_PASSWORD + '@'+ process.env.DB_HOST + ':' + process.env.DB_PORT +'/' + process.env.DB_NAME,{useNewUrlParser: true});

app.use(express.static('../images'));
app.use(express.json({limit: '50mb'}));
// app.use(express.urlencoded({limit: '50mb'}));
app.use(bodyParser.urlencoded({ limit: '50mb',extended: true }));
// app.use(bodyParser.json());


var routes = require('./api/routes/contractRoutes'); //importing route
routes(app); //register the route


app.listen(port, () => {
    console.log(`http://localhost:${port}`)
})


console.log('todo list RESTful API server started on: ' + port);
