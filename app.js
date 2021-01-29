//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const rp = require('request-promise');
const cheerio = require('cheerio');
  

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));


app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));


app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb://localhost:27017/USER_DB", {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);
const UserSchema = new mongoose.Schema ({
  email: String,
  password: String,
  googleId: String
 
});

UserSchema.plugin(passportLocalMongoose);
UserSchema.plugin(findOrCreate);

  
   const User = mongoose.model("User", UserSchema);

   passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/music",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
function(accessToken, refreshToken, profile, cb) {
  console.log(profile);

  User.findOrCreate({ googleId: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));


   app.get("/", function(req, res){
    res.render("home");
  });

  app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/music",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    res.redirect("/music");
  });

  app.get("/register", function(req, res){
    res.render("register");
  });

  app.post("/register",function(req,res){

    User.register({username: req.body.username}, req.body.password, function(err, user){
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function(){
          res.redirect("/music");
        });
      }
    });

  });
  app.get("/about", function(req, res){
    res.render("aboutus");
  });

  app.get("/login", function(req, res){
    res.render("login");
  });

  app.post("/login",function(req,res){
    const user = new User({
      username: req.body.username,
      password: req.body.password
    });
  
    req.login(user, function(err){
      if (err) {
        console.log(err);
      } else {
        passport.authenticate("local")(req, res, function(){
          res.redirect("/music");
        });
      }
    });
  });


  app.get("/music",function(req,res){
    if (req.isAuthenticated()){
      res.render("music");
    } else {
      res.redirect("/login");
    }
  });
  
app.get('/getmusic/:query',function(req,res){
  console.log(req.params.query);
  let query=(req.params.query).toString().trim().replace(/ /g,"+");
  let url1=`https://search.azlyrics.com/search.php?q=${query}`

  console.log(url1)
  rp(url1)
    .then((html)=>{
      let $ = cheerio.load(html);
      let panels = $('.panel');/* There are multiple panels like Album , Song,.. */
      let url2 = '';
      /* Find Song's panel */
      panels.each((i,panel)=>{
        /*Get heading text for this panel */
        let ph = $(panel).find('.panel-heading b').text();
        if(ph=='Song results:'){
          /*Get all anchor tags in this panel */
          let links = $(panel).find('.text-left>a');//about 20 links
          url2 = $($(links)[0]).attr('href');//get the first one 
          return;//break loop
        }
      });
      /* Send the lyric url to next promise */
      return url2;
      
    })
    .then((url)=>{
      console.log(url)
      rp(url)
      .then((html)=>{
        let $ = cheerio.load(html);
        let lyrics = $('.ringtone').nextAll().text();
        res.send(lyrics);
      })
      .catch((err)=>{
        res.send('Lyrics Not Found 1;(');
      });
    })
    .catch((err)=>{
      res.send('Lyrics Not Found 2;(');
    })


});
  
  app.get("/logout", function(req, res){
    req.logout();
    res.redirect("/");
  });


app.listen(3000, function() {
    console.log("Server started on port 3000");
  });
  





