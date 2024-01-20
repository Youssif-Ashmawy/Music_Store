var http = require('http');
var express = require('express');
var path = require('path');
var logger = require('morgan');
var  app = express(); //create express middleware dispatcher

const PORT = process.env.PORT || 3000

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs'); //use hbs handlebars wrapper

app.locals.pretty = true; //to generate pretty view-source code in browser

//read routes modules
var routes = require('./routes/index');

//some logger middleware functions
function methodLogger(request, response, next){
		   console.log("METHOD LOGGER");
		   console.log("================================");
		   console.log("METHOD: " + request.method);
		   console.log("URL:" + request.url);
		   next(); //call next middleware registered
}
function headerLogger(request, response, next){
		   console.log("HEADER LOGGER:")
		   console.log("Headers:")
           for(k in request.headers) console.log(k);
		   next(); //call next middleware registered
}


//middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(logger('dev'));

//routes
app.get('/index.html', routes.index);
app.post('/register', routes.register);
app.use(routes.authenticateUser);
app.get('/search',routes.search)
app.post('/searchSong', routes.searchSong);
app.get('/songs', routes.find);
app.get('/song/*', routes.songDetails);
app.post('/update',routes.update);
app.use(routes.authenticateAdmin);
app.get('/users', routes.users);
app.post('/delete', routes.delete);
app.post('/reset', routes.reset);




//start server
app.listen(PORT, err => {
  if(err) console.log(err)
  else {
		console.log(`Server listening on port: ${PORT} CNTL:-C to stop`)
		console.log(`To Test:`)
		console.log('Admin details')
		console.log('user: AdminUser password: 12345')
		console.log('http://localhost:3000/index.html')
  }
})
