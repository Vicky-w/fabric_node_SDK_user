var createError = require('http-errors');
var express = require('express');
// var logger = require('morgan');
// var log4js = require('./config/log');
var initHandler = require('./routes/init');
var queryRouter = require('./routes/query');
var invokeRouter = require('./routes/invoke');
var app = express();
var log4js = require('log4js');
var log = log4js.getLogger("app");
app.use(log4js.connectLogger(log4js.getLogger("http"), {level: 'auto'}));
app.use(express.json());
// app.use(express.urlencoded({extended: false}));
// app.use(cookieParser());

app.all('*', function (req, res, next) {
    console.log(req.method);
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    if (req.method == 'OPTIONS') {
        res.send(200);
    } else {
        next();
    }
});

app.post('/query', queryRouter);
app.post('/invoke', invokeRouter);


// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
// app.use(function (err, req, res, next) {
//     // set locals, only providing error in development
//     res.locals.message = err.message;
//     res.locals.error = req.app.get('env') === 'development' ? err : {};
//
//     // render the error page
//     res.status(err.status || 500);
//     res.render('error');
// });


/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        log.error("Something went wrong:", err);
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    log.error("Something went wrong:", err);
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
