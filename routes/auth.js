const express = require('express');
const { AuthenticationClient } = require('forge-server-utils');
const config = require('../config');

let authClient = new AuthenticationClient(config.client_id, config.client_secret);
let router = express.Router();

// GET /auth/login
router.get('/login', function (req, res) {
    const url = authClient.getAuthorizeRedirect(config.scopes, config.redirect_uri);
    res.redirect(url);
});

// GET /auth/callback
router.get('/callback', async function (req, res) {
    try {
        const token = await authClient.getToken(req.query.code, config.redirect_uri);
        req.session.access_token = token.access_token;
        req.session.refresh_token = token.refresh_token;
        req.session.expires_at = Date.now() + token.expires_in * 1000;
        const profile = await authClient.getUserProfile(req.session.access_token);
        req.session.user_name = profile.userName;
        res.redirect('/');
    } catch(err) {
        res.status(400).json(err);
    }
});

// GET /auth/logout
router.get('/logout', function (req, res) {
    delete req.session.access_token;
    delete req.session.refresh_token;
    delete req.session.expires_at;
    delete req.session.user_name;
    res.redirect('/');
});

// GET /auth/info.js
// Little hack to get the current access token to the client
router.get('/info.js', async function (req, res) {
    const { access_token, user_name, expires_at, refresh_token } = req.session;
    if (access_token) {
        if (Date.now() > expires_at) {
            try {
                const token = await authClient.refreshToken(config.scopes, refresh_token);
                req.session.access_token = token.access_token;
                req.session.refresh_token = token.refresh_token;
                req.session.expires_at = Date.now() + token.expires_in * 1000;
            } catch (err) {
                console.error(err);
                res.type('.js').send(`const AUTH = null;`);
                return;
            }
        }
        res.type('.js').send(`const AUTH = { user_name: '${user_name}', access_token: '${req.session.access_token}' };`);
    } else {
        res.type('.js').send(`const AUTH = null;`);
    }
});

module.exports = router;
