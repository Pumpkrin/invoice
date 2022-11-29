const express = require('express');
const router = express.Router();
const crypto_m = require('node:crypto');
const webcrypto_m = crypto_m.webcrypto;
const { Buffer: buffer_m} = require('node:buffer');
const {body, validationResult: validation_result} = require('express-validator');
const multer_m = require('multer');
const cbor_m = require('cbor');
const util_m = require('node:util');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'invoice' });
});

module.exports = router;
