require('dotenv').config();
var express = require('express'),
  app = express(),
  port = process.env.PORT || 3000,
  mongoose = require('mongoose'),
  Task = require('./api/models/todoListModel'), //created model loading here
  Contract = require('./api/models/contractModel'),
  router = express.Router(),
  bodyParser = require('body-parser');

// mongoose instance connection url connection
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/Tododb',{useNewUrlParser: true});
// mongoose.connect('mongodb://' + process.env.DB_USER + ':' + process.env.DB_PASSWORD + '@'+ process.env.DB_HOST + ':' + process.env.DB_PORT +'/' + process.env.DB_NAME,{useNewUrlParser: true});


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// app.use(function(req, res) {
//   res.status(404).send({url: req.originalUrl + ' not found'})
// });

// var routes = require('./api/routes/todoListRoutes'); //importing route
var routes = require('./api/routes/contractRoutes'); //importing route
routes(app); //register the route


app.listen(port, () => {
    console.log(`http://localhost:${port}`)
})


console.log('todo list RESTful API server started on: ' + port);
