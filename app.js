const express_m = require('express');
const path_m = require('node:path');
const index_router = require('./routes/index');
const discussion_router = require('./routes/discussion');
const doorway_router = require('./routes/doorway');
const helmet = require('helmet');
const compression = require('compression');
const app = express_m();
//REFLECT: CSP is set manually, and COEP blocks polyfill load for custom built-ins
app.use(helmet({contentSecurityPolicy:false, crossOriginEmbedderPolicy:false}));
app.use(compression());
app.disable('etag').disable('x-powered-by');

const mongoose_m = require('mongoose');
const db_url_local = 'mongodb://localhost:27017/invoice';
const mongo_db = process.env.MONGODB_URI || db_url_local;
mongoose_m.connect( mongo_db );
const database = mongoose_m.connection;
database.on( 'error', console.error.bind( console, "MongoDB connection error: ") );

app.set('views', path_m.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(express_m.static(path_m.join(__dirname, 'public')));
app.use('/', index_router);
app.use('/doorway', doorway_router);
app.use('/discussion', discussion_router);

const https_m = require('node:https');
const fs_m = require('node:fs');
const port = process.env.PORT || 3000;
app.set('host', process.env.HOST || 'localhost');
app.set('port', port);

const options = process.env.HOST ? {} : {
  key: fs_m.readFileSync('./localhost-key.pem'),
  cert: fs_m.readFileSync('./localhost.pem')
};

process.env.HOST ? 
  app.listen(port):
  https_m.createServer(options, app).listen(port);
