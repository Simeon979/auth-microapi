const router = require('express').Router();
const { User } = require('../models/user');
const validation = require('../validation/authValidation');
const { auth } = require('../middleware/auth');
const { DbError, AuthError } = require('../utils/error');
const jwt = require('jsonwebtoken');

router.get('/active', auth, (req, res) => {
  res.status(200).json({
    _id: req.user._id,
    isAdmin: req.user.isAdmin,
    isAuth: true,
    email: req.user.email,
    username: req.user.username,
  });
});

router.post(
  '/admin/register',
  validation.registerValidation(),
  (req, res, next) => {
    User.findOne({ email: req.body.email }, (err, check_user) => {
      if (err) {
        return next(new DbError(err, 500));
      }
      if (check_user) {
        return res.json({
          loginSuccess: false,
          message: 'Auth failed, email already exist',
        });
      }
      const user = new User(req.body);
      user.save((err, doc) => {
        if (err) {
          return next(new DbError(err, 500));
        }
        return res.status(200).json({
          success: true,
          doc,
        });
      });
    });
  }
);

router.post('/guest/login', (req, res) => {
  // check cookie header for token
  const { api_key, email, password } = req.body;

  if (!api_key) {
    return res.status(403).json({
      status: 'failed',
      message: 'API_KEY is missing',
    });
  }
  // decode key to validate where it came from

  jwt.verify(api_key, process.env.JWT_SECRET, (err, decode) => {
    console.log(decode);

    if (!decode) {
      return res.status(403).json({
        status: 'failed',
        message: 'API_KEY is invalid',
      });
    }
    User.findOne({ _id: decode.id, role: decode.role }, (err, user) => {
      if (err)
      {return res.status(505).json({
        status: 'failed',
        message: 'Something went wrong',
      });}

      if (!err && !user) {
        return res.status(403).json({
          status: 'failed',
          message: 'invalid API_KEY',
        });
      }

      // login

      User.findOne({ email, role: 'user' }, (err, user) => {
        if (err)
        {return res.status(505).json({
          status: 'failed',
          message: 'Something went wrong',
        });}

        if (!user) {
          return res.status(505).json({
            status: 'failed',
            message: 'User not found',
          });
        }

        if (user && !err) {
          // compare password
          user.comparePassword(password, (err, matched) => {
            if (err)
            {return res
              .status(403)
              .json({ status: 'failed', message: 'Something went wrong' });}

            if (!matched) {
              return res.status(401).json({
                status: 'failed',
                message: 'Email and password do not match our records',
              });
            }

            user.generateToken((err, user) => {
              if (err) {
                return res.status(400).send(err);
              }
              res.cookie('w_authExp', user.tokenExp);
              res.cookie('w_auth', user.token).status(200).json({
                loginSuccess: true,
                userId: user._id,
                token: user.token,
                role: 'user',
              });
            });
          });
        }
      });
    });
  });
});

router.post('/guest/register', (req, res) => {
  // check cookie header for token
  const { api_key, email } = req.body;

  if (!api_key) {
    return res.status(403).json({
      status: 'failed',
      message: 'API_KEY is missing',
    });
  }

  // decode key to validate where it came from

  jwt.verify(api_key, process.env.JWT_SECRET, (err, decode) => {
    console.log(decode);

    if (!decode) {
      return res.status(403).json({
        status: 'failed',
        message: 'API_KEY is invalid',
      });
    }
    User.findOne({ _id: decode.id, role: decode.role }, (err, adminDoc) => {
      if (err)
      {return res.status(505).json({
        status: 'failed',
        message: 'Something went wrong',
      });}

      if (!err && !adminDoc) {
        return res.status(403).json({
          status: 'failed',
          message: 'invalid API_KEY',
        });
      }

      // register

      User.findOne({ email, role: 'user' }, (err, userDoc) => {
        if (userDoc) {
          return res.status(403).json({
            status: 'failed',
            message: 'Email address already in use',
          });
        }
        const user = new User({ ...req.body, role: 'user' });

        user.save((err, savedUser) => {
          if (err)
          {return res.json({
            status: 'failed',
            message: 'Failed to create user account',
          });}

          return res.status(201).json({
            status: 'success',
            message: 'Account created successfully',
            data: { ...savedUser._doc, password: undefined },
          });
        });
      });
    });
  });
});

router.post('/admin/login', validation.loginValidation(), (req, res) => {
  User.findOne({ email: req.body.email }, (err, user) => {
    if (err) {
      return next(new DbError(err, 500));
    }
    if (!user) {
      return res.json({
        loginSuccess: false,
        message: 'Auth failed, email not found',
      });
    }

    user.comparePassword(req.body.password, (err, isMatch) => {
      if (err) {
        return next(new HashError(err, 500));
      }
      if (!isMatch) {
        return res.json({ loginSuccess: false, message: 'Wrong password' });
      }

      user.generateToken((err, user) => {
        if (err) {
          return next(err);
        }
        res.cookie('w_authExp', user.tokenExp);
        res.cookie('w_auth', user.token).status(200).json({
          loginSuccess: true,
          userId: user._id,
          API_KEY: user.generateAPIKEY(),
        });
      });
    });
  });
});

router.get('/logout', auth, (req, res, next) => {
  User.findOneAndUpdate(
    { _id: req.user._id },
    { token: '', tokenExp: '' },
    (err, doc) => {
      if (err) {
        return next(new DbError(err, 500));
      }
      return res.status(200).send({
        success: true,
      });
    }
  );
});
module.exports = router;
