const path = require('path');
const express = require('express');
const session = require('cookie-session');

const config = require('./config.js');

let app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/temp', express.static(path.join(__dirname, 'temp')));
app.use(session({ name: config.session.name, keys: [config.session.secret], maxAge: config.session.age }));
app.use('/auth', require('./routes/auth'));
app.use('/convert', require('./routes/convert'));
app.listen(config.port, () => { console.log(`Server listening on port ${config.port}...`); });
