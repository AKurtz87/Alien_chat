const crypto = require("crypto");

const prompt = require("prompt");

const MongoClient = require("mongodb").MongoClient;
//const url = "mongodb://127.0.0.1:27017";

const url =
  "mongodb+srv://admin:admin@cluster0.n5uvo.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";

prompt.get(
  ["username", "password", "operation", "avatar"],
  function (err, result) {
    const user = result.username;
    const password = result.password;
    const operation = result.operation;
    const avatar = result.avatar;

    switch (operation) {
      case "add":
        add_user(user, password, avatar);
        break;
      case "delete":
        delete_user(user);
        break;
      case "update":
        update_psw(user, password);
        break;
    }
  }
);

const add_user = function (username, password, avatar) {
  const hash = crypto.createHash("md5").update(password).digest("hex");
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("users");
    var myobj = {
      user: username,
      password: hash,
      avatar: avatar,
    };
    dbo.collection("users").insertOne(myobj, function (err, res) {
      if (err) throw err;
      console.log("1 document inserted");
      db.close();
    });
  });
  // fs append css to style.css
};

const delete_user = function (username) {
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("users");
    var myquery = { user: username };
    dbo.collection("users").deleteOne(myquery, function (err, obj) {
      if (err) throw err;
      console.log("1 document deleted");
      db.close();
    });
  });
};

const update_psw = function (username, password) {
  const hash = crypto.createHash("md5").update(password).digest("hex");
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("users");
    var myquery = { user: username };
    var newvalues = { $set: { password: hash } };
    dbo.collection("users").updateOne(myquery, newvalues, function (err, res) {
      if (err) throw err;
      console.log("1 document updated");
      db.close();
    });
  });
};
