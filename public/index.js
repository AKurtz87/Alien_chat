// create favicon, save this string as .svg
// <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"> <text y=".9em" font-size="90">👽</text> </svg>

const crypto = require("crypto");
const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");

const bodyParser = require("body-parser");

const MongoClient = require("mongodb").MongoClient;
//const url = "mongodb://127.0.0.1:27017";
const url =
  "mongodb+srv://admin:admin@cluster0.n5uvo.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";

const app = express();
const server = http.createServer(app);

const io = socketio(server);
//const port = process.env.PORT || 3000;

const port = 8000;

const publicDirectoryPath = path.join(__dirname, "../public");

app.use(express.static(publicDirectoryPath));

app.use(bodyParser.urlencoded({ extended: false }));

//
// --------------------------------------------------------------------------//
// REQUEST
//
let username;
let password;
let avatar;
let room;
let check;
let user;
let rooms = [];

app.post("/login", (req, res) => {
  username = req.body.username;
  password = req.body.password;
  const hash = crypto.createHash("md5").update(password).digest("hex");

  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("users");
    var query = { user: username };
    dbo
      .collection("users")
      .find(query)
      .toArray(function (err, result) {
        if (err) throw err;
        //console.log(result);
        if (!result[0]) {
          res.sendFile("/index.html", { root: __dirname });
        } else {
          check = result[0].password;
          user = result[0].user;
          avatar = result[0].avatar;
          switch (avatar) {
            case "saturn":
              avatar = "🪐";
              break;
            case "moon":
              avatar = "🌖";
              break;
            case "world":
              avatar = "🌎";
              break;
            case "star":
              avatar = "⭐️";
              break;
          }
          db.close();
          if (hash === check && username === user) {
            res.sendFile("/access.html", { root: __dirname });
            //return username, password;
          } else {
            res.sendFile("/index.html", { root: __dirname });
          }
        }
      });
  });
});

app.get("/join", (req, res) => {
  room = req.query.room;
  //console.log(avatar, room, user);
  if (room) {
    MongoClient.connect(url, function (err, db) {
      if (err) throw err;
      var dbo = db.db("chat");
      dbo.listCollections().toArray(function (err, result) {
        if (err) throw err;
        //console.log(result);
        result.forEach(myFunction);

        function myFunction(item) {
          rooms.push(item.name);
        }

        db.close();
        //console.log(rooms);
        if (rooms.includes(room)) {
          res.sendFile("/chat.html", { root: __dirname });
        } else {
          console.log("room not exist!");
          res.redirect("/");
        }
      });
    });
  } else {
    console.log("parameters required!!!");
    res.redirect("/");
  }
});

app.get("/logout", (req, res) => {
  res.redirect("/");
});

//
// --------------------------------------------------------------------------//
// DATABASE METHOD
//
const db_save = function (collection, user, text) {
  MongoClient.connect(
    url,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
    (err, client) => {
      if (err) {
        return console.log(err);
      }

      const db = client.db("chat").collection(collection);

      const date = new Date().getTime();

      db.insertOne({
        date: date,
        room: collection,
        user: user,
        text: text,
      });
    }
  );
};

//
// --------------------------------------------------------------------------//
// MESAGE + USER METHOD
//
const generateMessage = (username, text) => {
  return {
    username,
    text,
    createdAt: new Date().getTime(),
  };
};

const generateHistory = (username, text, date) => {
  return {
    username,
    text,
    createdAt: date,
  };
};

const users = [];

const addUser = (id, username, room, avatar) => {
  // Clean the data
  username = username.trim().toUpperCase();
  room = room.trim().toLowerCase();

  // Validate the data
  if (!username || !room) {
    return {
      error: "Username and room are required!",
    };
  }

  // Check for existing user
  const existingUser = users.find((user) => {
    return user.room === room && user.username === username;
  });

  // Validate username
  if (existingUser) {
    return {
      error: "Username is in use!",
    };
  }

  // Store user
  const user = { id, username, room, avatar };
  users.push(user);
  return { user };
};

const removeUser = (id) => {
  const index = users.findIndex((user) => user.id === id);

  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
};

const getUser = (id) => {
  return users.find((user) => user.id === id);
};

const getUsersInRoom = (room) => {
  room = room.trim().toLowerCase();
  return users.filter((user) => user.room === room);
};

//
// --------------------------------------------------------------------------//
// SOCKET METHOD
//
io.on("connection", (socket) => {
  console.log("New WebSocket connection");

  socket.on("join", (options, callback) => {
    let id = socket.id;
    const { error, user } = addUser(id, username, room, avatar);

    if (error) {
      return callback(error);
    }

    socket.join(user.room);

    const db_load = function (collection) {
      MongoClient.connect(
        url,
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        },
        (err, client) => {
          if (err) {
            return console.log(err);
          }

          const db = client.db("chat").collection(collection);

          db.find()
            .toArray()
            .then((results) => {
              results.forEach((element) => {
                let nome = element.user;
                let data = element.date;
                let testo = element.text;

                socket.emit("message", generateHistory(nome, testo, data));
              });
            });
        }
      );
    };
    db_load(user.room);

    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
      avatar: avatar,
    });

    callback();
  });

  socket.on("sendMessage", (message, callback) => {
    const user = getUser(socket.id);
    io.to(user.room).emit("message", generateMessage(user.username, message));
    callback();
    db_save(user.room, user.username, message);
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

//
// --------------------------------------------------------------------------//
// SERVER LISTENING
//
server.listen(port, "0.0.0.0", () => {
  console.log(`Server is up on port ${port}!`);
});
