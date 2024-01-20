
var url = require('url');
const fetch = require('node-fetch');
var sqlite3 = require('sqlite3').verbose(); //verbose provides more detailed stack trace
var db = new sqlite3.Database('data/db_songs');
const http = require('http');
// variable to store the current song's id
var currentSongID;

exports.searchSong = function (request, response) {
  const searchItem = request.body.newSearchSong; 

  // Function to clear the existing data in the songs table
  const clearQuery = 'DELETE FROM songs';
  db.run(clearQuery, function (err) {
    if (err) {
      console.error('Error clearing data:', err.message);
    } else {
      console.log('Data cleared successfully.');
    }
  });

  // Check if a song with the same title and artist already exists
  const isSongExists = async (title, artist) => {
    return new Promise((resolve, reject) => {
      const checkQuery = 'SELECT COUNT(*) as count FROM songs WHERE title = ? AND artist = ?';
      db.get(checkQuery, [title, artist], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count > 0);
        }
      });
    });
  };

  // Fetch data for the specified searchItem
  const fetchDataForSearchItem = async (searchItem) => {
    const title = encodeURIComponent(searchItem);

    const options = {
      method: 'GET',
      hostname: 'itunes.apple.com',
      port: null,
      path: `/search?term=${title}&entity=song`,
      headers: {
        useQueryString: true,
      },
    };

    const req = http.request(options, async (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', async () => {
        try {
          const responseData = JSON.parse(data);

          // Handle the retrieved data (for debug)
          // console.log(responseData);

          // Insert data into the SQLite database if it doesn't already exist
          const insertQuery = 'INSERT INTO songs (title, artist, artwork, genre, price) VALUES (?, ?, ?, ?, ?)';

          for (const item of responseData.results) {
            const { trackName, artistName, artworkUrl100, primaryGenreName, trackPrice } = item;

            // Check if the song already exists in the database
            const songExists = await isSongExists(trackName, artistName);

            // If the song doesn't exist, insert it into the database
            if (!songExists) {
              db.run(insertQuery, [trackName, artistName, artworkUrl100, primaryGenreName, trackPrice], (err) => {
                if (err) {
                  console.error(err.message);
                }
              });
            }
          }

          // Redirect to the "/songs" page after fetching and inserting data
          response.redirect("/songs");

        } catch (error) {
          console.error(`Error parsing data for ${searchItem}:`, error);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Error making HTTP request for ${searchItem}:`, error);
    });

    req.end();
  };

  // Fetch data for the specified searchItem
  fetchDataForSearchItem(searchItem);
};





exports.register = function (request, response) {
    var newUsername = request.body.newUsername;
    var newPassword = request.body.newPassword;

    // insert new user into the database
    var insertUser = "INSERT INTO users VALUES (?, ?,'guest',0.0)";
    db.run(insertUser, [newUsername, newPassword], function (err) {
        if (err) {
            console.error(err.message);
            response.status(500).send('Error registering user');
        } else {
            console.log(`User ${newUsername} registered successfully`);
            response.redirect('/search'); 
        }
    });
};

exports.authenticateUser = function (request, response, next){
    var auth = request.headers.authorization;
    // auth is a base64 representation of (username:password)
    //so we will need to decode the base64
    if(!auth){
        response.setHeader('WWW-Authenticate', 'Basic realm="need to login"');
        response.writeHead(401, {'Content-Type': 'text/html'});
        console.log('No authorization found, send 401.');
        response.end();
    }
    else{
        console.log("Authorization Header: " + auth);
        //decode authorization header
        // Split on a space, the original auth
        //looks like  "Basic Y2hhcmxlczoxMjM0NQ==" and we need the 2nd part
        var tmp = auth.split(' ');

        // create a buffer and tell it the data coming in is base64
        var buf = Buffer.from(tmp[1], 'base64');

        // read it back out as a string
        //should look like 'Youssif:1234'
        var plain_auth = buf.toString();
        console.log("Decoded Authorization ", plain_auth);

        //extract the userid and password as separate strings
        var credentials = plain_auth.split(':');      // split on a ':'
        var username = credentials[0];
        var password = credentials[1];
        console.log("User: ", username);
        console.log("Password: ", password);

        var authorized = false;
        //check database users table for user
        db.all("SELECT userid, password FROM users", function(err, rows){
        for(var i=0; i<rows.length; i++){
              if(rows[i].userid == username & rows[i].password == password){
                request.user_id = rows[i].userid;
                authorized = true;
              }
               
        }
        if(authorized == false){
           //we had an authorization header by the user:password is not valid
           response.setHeader('WWW-Authenticate', 'Basic realm="need to login"');
           response.writeHead(401, {'Content-Type': 'text/html'});
           console.log('No authorization found, send 401.');
           response.end();
        }
        else
          next();
        });
    }
}

exports.authenticateAdmin = function(request, response, next) {
    let auth = request.headers.authorization
    // auth is a base64 representation of (username:password)
    //so we will need to decode the base64
    if (!auth) {
      response.setHeader('WWW-Authenticate', 'Basic realm="need to login"')
      response.writeHead(401, {
        'Content-Type': 'text/html'
      })
      console.log('No authorization found, send 401.')
      response.end();
    } else {
      console.log("Authorization Header: " + auth)
      //decode authorization header
      // Split on a space, the original auth
      //looks like  "Basic Y2hhcmxlczoxMjM0NQ==" and we need the 2nd part
      var tmp = auth.split(' ')
  
      // create a buffer and tell it the data coming in is base64
      var buf = Buffer.from(tmp[1], 'base64');
  
      // read it back out as a string
      //should look like 'Youssif:1234'
      var plain_auth = buf.toString()
      console.log("Decoded Authorization ", plain_auth)
  
      //extract the userid and password as separate strings
      var credentials = plain_auth.split(':') // split on a ':'
      var username = credentials[0]
      var password = credentials[1]
      console.log("User: ", username)
      console.log("Password: ", password)
  
      var authorized = false
      // check database users table for user
      db.all("SELECT userid, password, role FROM users", function(err, rows) {
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].userid == username && rows[i].password == password && rows[i].role == 'admin') {
            request.user_role = rows[i].role;
            authorized = true;
          }
        }
        if (!authorized) {
          // No valid user found
          response.setHeader('WWW-Authenticate', 'Basic realm="need to login"')
          response.writeHead(401, { 'Content-Type': 'text/html' })
          console.log('No authorization found, send 401.')
          response.end()
        } else {
          // Valid user, proceed to the next middleware
          next()
        }
      })
    }
  }

exports.index = function (request, response){
         response.render('index');
}

function parseURL(request, response){
    var parseQuery = true; //parseQueryStringIfTrue
    var slashHost = true; //slashDenoteHostIfTrue
    var urlObj = url.parse(request.url, parseQuery , slashHost );
    console.log('path:');
    console.log(urlObj.path);
    console.log('query:');
    console.log(urlObj.query);
    //for(x in urlObj.query) console.log(x + ': ' + urlObj.query[x]);
    return urlObj;

}

exports.users = function(request, response){
        db.all("SELECT userid, password, role, totalCost FROM users", function(err, rows){
           response.render('users', {title : 'Users:', userEntries: rows});
        })

}

exports.find = function (request, response) {
  console.log("RUNNING FIND SONGS");

  var urlObj = parseURL(request, response);
  var songSql = "SELECT id, title, artist FROM songs";

  if (urlObj.query['title']) {
      let keywords = urlObj.query['title']
      keywords = keywords.replace(/\s/g, '%')
      console.log("finding title: " + keywords);
      songSql = "SELECT id, title, artist FROM songs WHERE title LIKE '%" +
          keywords + "%'";
  }

  var userSql = "SELECT totalCost FROM users WHERE userID = ?";
  var userId = request.user_id;

  db.get(userSql, [userId], function (err, userRow) {
      if (err) {
          console.error(err);
          return;
      }

      var totalCost = userRow ? userRow.totalCost : 0;
      // round it to 2 dp
      totalCost = totalCost.toFixed(2);

      // Fetch songs
      db.all(songSql, function (err, songRows) {
          if (err) {
              console.error(err);
              return;
          }

          response.render('songs', {
              title: 'Songs Result:', 
              songEntries: songRows,
              amount: totalCost
          });
      });
  });
}

exports.songDetails = function(request, response){

    var urlObj = parseURL(request, response);
    var songID = urlObj.path; //expected form: /song/235
    songID = songID.substring(songID.lastIndexOf("/")+1, songID.length);
    currentSongID = songID;
    var sql = "SELECT title, artist, genre, artwork, price FROM songs WHERE id=" + songID;
    console.log("GET SONG DETAILS: " + songID );
        
    db.all(sql, function(err, rows) {
        let song = rows[0];
        console.log('Song Details');
        console.log(song);
        response.render('songDetails', { title: 'Song Details:', song: song });
    });
}


exports.update = function (request, response) {
  var songID = currentSongID ;
  var user = request.user_id;
  console.log("SONGID IS : " + songID);
  console.log("USER: " + user);
  
  const query = `SELECT price FROM songs WHERE songID = ?`;

  // select the price of the song with the given songID
  const selectQuery = `SELECT price FROM songs WHERE id = ?`;

  // get the price
  db.get(selectQuery, [songID], (err, row) => {
    if (err) {
      console.error(err.message);
      return;
    }

    // check if a row was returned
    if (row) {
      const songPrice = row.price;
      console.log("SONG PRICE: " + songPrice);

      // update the totalCost in the users table
      const updateQuery = `UPDATE users SET totalCost = totalCost + ? WHERE userID = ?`;

      db.run(updateQuery, [songPrice, user], (err) => {
        if (err) {
          console.error(err.message);
        } else {
          console.log(`Total cost updated successfully for user ${user}`);
        }
      });
    } else {
      console.log(`No song found with songID ${songID}`);
    }
    response.redirect('/songs');
  });
};

exports.reset = function(request, response){
  const query = `UPDATE users SET totalCost = 0.0`;

  db.run(query, function(err) {
    if (err) {
      console.error(err.message);
    } else {
      console.log('Total cost reset successfully for all users.');
    }
    response.redirect('/users');
  });
};

exports.delete = function(request, response){
  const query = `DELETE FROM users WHERE role = 'guest'`;

  db.run(query, function(err) {
    if (err) {
      console.error(err.message);
    } else {
      console.log('Users with role "guest" deleted successfully.');
    }
    response.redirect('/users');
  });
};

exports.search = function (request, response){
  response.render('search');
}

