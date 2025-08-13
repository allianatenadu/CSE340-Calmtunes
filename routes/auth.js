// routes/auth.js
const express = require('express');
const router = express.Router();

router.get('/login', (req, res) => {
  res.render('pages/login', { 
    title: 'Login - CalmTunes',
    user: req.session?.user || null
  });
});

router.get('/signup', (req, res) => {
  res.render('pages/signup', { 
    title: 'Sign Up - CalmTunes',
    user: req.session?.user || null
  });
});


module.exports = router;
