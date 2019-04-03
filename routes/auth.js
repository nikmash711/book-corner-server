'use strict';

const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');

const { JWT_SECRET, JWT_EXPIRY } = require('../config');

const router = express.Router();
const User = require('../models/user');

const localAuth = passport.authenticate('local', { session: false, failWithError: true });

router.post('/login', localAuth, (req, res) => {
  const authToken = createAuthToken(req.user);
  res.json({ authToken });
});

const jwtAuth = passport.authenticate('jwt', { session: false, failWithError: true });

router.post('/refresh', jwtAuth, (req, res, next) => {
  const userId = req.user.id; 
  User.findById(userId)
    .then(user=>{
      const authToken = createAuthToken(user);
      res.json({ authToken });
    })
    .catch(err=>{
      next(err);
    });
});

function createAuthToken(user) {
  return jwt.sign({ user }, JWT_SECRET, {
    subject: user.email,
    expiresIn: JWT_EXPIRY
  });
}

module.exports = router;