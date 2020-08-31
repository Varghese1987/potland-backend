const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const mongodb = require("mongodb");
const mongoClient = mongodb.MongoClient;
const bcrypt = require("bcrypt");
const randomstring = require("randomstring");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const { response } = require("express");
dotenv.config();

app.use(bodyParser.json());
app.use(cors());

//production URLs:
const dbUrl =
  "mongodb+srv://varghese123:varghese123@cluster0-yqune.mongodb.net/<dbname>?retryWrites=true&w=majority";
const serverURL = "https://potland.herokuapp.com";
const frontEndURL = "https://pot-land.netlify.app/#/";

// development URLs:
// const dbUrl = "mongodb://localhost:27017";
// const serverURL = "http://localhost:3000";
// const dbUrl = "mongodb://13.127.169.233:27017/sample";
// const frontEndURL = "http://localhost:4200/#/";

// ******************Middlewares to restrict the route access******************

function authenticate(req, res, next) {
  if (req.headers.authorization == undefined) {
    res.status(401).json({
      message: "Not a Valid User",
    });
  } else {
    //console.log(req.headers.authorization)
    jwt.verify(req.headers.authorization, "qwert", (err, decoded) => {
      //console.log(decoded)
      if (decoded == undefined) {
        res.status(401).json({
          message: "Not a Valid User",
        });
      } else {
        req.role = decoded.role;
        //console.log(req.role);
        next();
      }
    });
  }
}

function permit(...allow) {
  // console.log(allow);
  const isAllow = (role) => allow.indexOf(role) > -1;
  return (req, res, next) => {
    //console.log(req.role)
    if (isAllow(req.role)) next();
    else response.status(401).json({ message: "Not authorized" });
  };
}

// ******************End of Middle Ware Section******************

let empId = 100000;
app.post("/addUser", (req, res) => {
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("potLand");
    db.collection("users").findOne({ email: req.body.email }, (err, data) => {
      if (err) throw err;
      if (data) {
        res.status(400).json({
          message: "User already Exist",
        });
      } else {
        bcrypt.genSalt(2, (err, salt) => {
          bcrypt.hash(req.body.password, salt, (err, hash) => {
            req.body.password = hash;
            db.collection("users").insertOne(req.body, (err, data) => {
              if (err) throw err;
              if (data) {
                let string = randomstring.generate();
                empId = empId + 1;
                db.collection("users").updateOne(
                  { email: req.body.email },
                  { $set: { randomstring: string, activate: false, empId } },
                  { upsert: true },
                  (err, response) => {
                    client.close();
                    if (err) throw err;
                    if (response) {
                      let transporter = nodemailer.createTransport({
                        // host: "smtp.gmail.com",
                        // port: 587,
                        // secure: false,
                        service:'gmail',
                        auth: {
                          user: "varghese87joseph@gmail.com",
                          pass: process.env.PASSWORD,
                        },
                        tls: {
                          rejectUnauthorized: false,
                        },
                      });
                      let mailOptions = {
                        from: "varghese87joseph@gmail.com",
                        to: req.body.email,
                        subject: "Activate User Account",
                        text: string,
                        html: `<a href='${serverURL}/activateuser/${string}'>Click her to Activate your Account</a>`,
                      };
                      transporter.sendMail(mailOptions, (err, data) => {
                        if (err) {
                          console.log(err);
                        } else {
                          console.log("Email Sent:" + data.response);
                        }
                      });
                      res.status(200).json({
                        message: "success",
                      });
                    }
                  }
                );
              }
            });
          });
        });
      }
    });
  });
});

app.get("/activateuser/:string", (req, res) => {
  //console.log(req.params.string);
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("potLand");
    db.collection("users").findOne(
      { randomstring: req.params.string },
      (err, data) => {
        //console.log(data);
        if (err) throw err;
        if (data) {
          db.collection("users").updateOne(
            { _id: data._id },
            { $set: { activate: true, randomstring: "" } },
            { upsert: true },
            (err, data) => {
              client.close();
              if (err) throw err;
              if (data) {
                res.status(200).json({
                  message: "Please Login to make use of the service",
                });
              }
            }
          );
        } else {
          res.status(401).json({
            message: "Details doesnt match",
          });
        }
      }
    );
  });
});

app.post("/check-user", (req, res) => {
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("potLand");
    db.collection("users").findOne({ email: req.body.email }, (err, data) => {
      if (err) throw err;
      if (data) {
        let string = randomstring.generate();
        db.collection("users").updateOne(
          { email: data.email },
          { $set: { randomstring: string } },
          { upsert: true },
          (err, response) => {
            client.close();
            if (err) throw err;
            if (response) {
              let transporter = nodemailer.createTransport({
                // host: "smtp.gmail.com",
                // port: 587,
                // secure: false,
                service:'gmail',
                auth: {
                  user: "varghese87joseph@gmail.com",
                  pass: process.env.PASSWORD,
                },
                // tls: {
                //   rejectUnauthorized: false,
                // },
              });
              let mailOptions = {
                from: "varghese87joseph@gmail.com",
                to: req.body.email,
                subject: "Change Password",
                text: string,
                html: `<a href='${frontEndURL}/resetpwd/${string}'>Click here to Rest password</a>`,
              };
              transporter.sendMail(mailOptions, (err, data) => {
                if (err) {
                  console.log(err);
                } else {
                  console.log("Email Sent:" + data.response);
                }
              });
              res.status(200).json({
                message: "success",
              });
            }
          }
        );
      } else {
        res.status(401).json({
          message: "Email doesnt exist",
        });
      }
    });
  });
});

app.put("/reset-password/:string", (req, res) => {
  //console.log(req.params.string)
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("potLand");
    db.collection("users").findOne(
      { randomstring: req.params.string },
      (err, data) => {
        if (err) throw err;
        if (data) {
          bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(req.body.password, salt, (err, hash) => {
              req.body.password = hash;
              db.collection("users").updateOne(
                { randomstring: req.params.string },
                { $set: { password: req.body.password, randomstring: "" } },
                { upsert: true },
                (err, data) => {
                  client.close();
                  if (err) throw err;
                  if (data) {
                    res.status(200).json({
                      message: "Password updated",
                    });
                  }
                }
              );
            });
          });
        } else {
          res.status(401).json({
            message:
              "Details doesnt match generate a fresh link to reset the password",
          });
        }
      }
    );
  });
});

app.post("/login", (req, res) => {
  mongoClient.connect(dbUrl, (err, client) => {
    let db = client.db("potLand");
    db.collection("users").findOne({ email: req.body.email }, (err, data) => {
      client.close();
      if (data) {
        //console.log(data)
        if (data.activate) {
          bcrypt.compare(req.body.password, data.password, (err, result) => {
            if (result) {
              jwt.sign(
                { userid: data._id, role: data.role },
                "qwert",
                { expiresIn: "12h" },
                (err, token) => {
                  if (err) throw err;
                  if (token) {
                    res.status(200).json({
                      message: "success",
                      token: token,
                      userId: data._id,
                      role: data.role,
                      name: data.fName
                    });
                  }
                }
              );
            } else {
              res.status(401).json({
                message: "Wrong Credentials",
              });
            }
          });
        } else {
          res.status(401).json({
            message: "User Not activated",
          });
        }
      } else {
        res.status(401).json({
          message: "User doesnt exist pls register for accessing",
        });
      }
    });
  });
});

app.get("/userList", [authenticate, permit("admin", "manager")], (req, res) => {
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("potLand");
    db.collection("users")
      .find()
      .toArray()
      .then((data) => {
        res.status(200).json(data);
      })
      .catch((error) => {
        console.log(error);
      });
  });
});

app.get("/user/:id", [authenticate, permit("admin", "manager")], (req, res) => {
  let objId = mongodb.ObjectID(req.params.id);
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("potLand");
    db.collection("users").findOne({ _id: objId }, (err, data) => {
      if (err) throw err;
      client.close();
      res.status(200).json(data);
    });
  });
});

app.put("/user/:id", [authenticate, permit("admin", "manager")], (req, res) => {
  let objId = mongodb.ObjectID(req.params.id);
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("potLand");
    db.collection("users")
      .findOneAndUpdate(
        { _id: objId },
        {
          $set: {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            role: req.body.role,
          },
        },
        { upsert: true }
      )
      .then((data) => {
        client.close();
        res.status(200).json({
          message: "success",
        });
      });
  });
});

app.delete(
  "/user/:id",
  [authenticate, permit("admin", "manager")],
  (req, res) => {
    let objId = mongodb.ObjectID(req.params.id);
    mongoClient.connect(dbUrl, (err, client) => {
      if (err) throw err;
      let db = client.db("potLand");
      db.collection("users").findOneAndDelete({ _id: objId }, (err, data) => {
        if (err) throw err;
        client.close();
        res.status(200).json({
          message: "record Deleted",
        });
      });
    });
  }
);

let productNo = 100;
app.post(
  "/addProduct/:id",
  [authenticate, permit("admin", "manager", "employeeLevel-2")],
  (req, res) => {
    let objId = mongodb.ObjectID(req.params.id);
    mongoClient.connect(dbUrl, (err, client) => {
      if (err) throw err;
      let db = client.db("potLand");
      let obj = {
        name : req.body.name,
        price : req.body.price,
        category : req.body.category,
        imgUrl : req.body.imgUrl,
        shortDesc:req.body.shortDesc,
        longDesc:req.body.longDesc,
        userId: objId,
        productNo: productNo + 1,
      };
      db.collection("products").insertOne(obj, (err, data) => {
        if (err) throw err;
        if (data) {
          res.status(200).json({
            message: "Data Updated",
          });
        }
      });
    });
  }
);

app.get("/productList",(req, res) => {
    mongoClient.connect(dbUrl, (err, client) => {
      if (err) throw err;
      let db = client.db("potLand");
      db.collection("products")
        .find()
        .toArray()
        .then((data) => {
          res.status(200).json(data);
        })
        .catch((error) => {
          console.log(error);
        });
    });
  }
);

app.get("/product/:id", [authenticate, permit("admin", "manager")], (req, res) => {
  let objId = mongodb.ObjectID(req.params.id);
  mongoClient.connect(dbUrl, (err, client) => {
    if (err) throw err;
    let db = client.db("potLand");
    db.collection("products").findOne({ _id: objId }, (err, data) => {
      if (err) throw err;
      client.close();
      res.status(200).json(data);
    });
  });
});

app.delete(
  "/product/:id",
  [authenticate, permit("admin", "manager")],
  (req, res) => {
    let objId = mongodb.ObjectID(req.params.id);
    mongoClient.connect(dbUrl, (err, client) => {
      if (err) throw err;
      let db = client.db("potLand");
      db.collection("products").findOneAndDelete({ _id: objId }, (err, data) => {
        if (err) throw err;
        client.close();
        res.status(200).json({
          message: "record Deleted",
        });
      });
    });
  }
);


// var reqTimer = setTimeout(function wakeUp() {
//   request(`${serverURL}`, function() {
//      console.log("WAKE UP DYNO");
//   });
//   return reqTimer = setTimeout(wakeUp, 1200000);
// }, 1200000);


app.get("/", (req, res) => {
  res.send("Welcome to potland API");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("App started");
});
