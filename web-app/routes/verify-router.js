const express = require('express');
const router = express.Router();
const verifyController = require('../controllers/verify-controller');

let title = "Verification Portal";
let root = "verify";


router.get('/', function(req, res, next) {
    if (req.query && req.query.proof) {
        req.body = { proofObject: req.query.proof };
        return verifyController.postVerify(req, res, next);
    }
    res.render('verify', {   title, root,
        logInType: req.session.user_type || "none"
    });
});

router.post('/', verifyController.postVerify);

module.exports = router;
