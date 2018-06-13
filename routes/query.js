/**
 * Created by vickywang on 6/5/18
 */
/**
 * Created by vickywang on 5/30/18
 */
'use strict';
var initHandler = require('./init');
var config_user_peer
var userConfig
var client
var channel
var response = {};
var peer;
var peers;
var request;
var logger = require('log4js').getLogger("Query - Chaincode");
// var logger = require('../config/log');
// logger.setLogger("query_chaincode");

var query_chaincode = function (req, res) {
    userConfig = initHandler.userConfig
    client = initHandler.client
    channel = initHandler.channel;
    config_user_peer = initHandler.config_user_peer

    var chaincodeId = req.body.chaincodeId;
    // var channelName = req.body.channelName;
    var fcn = req.body.fcn;
    var args = req.body.args;

    peers = channel.getPeers();
    peers.forEach(function (value, index, array) {
        if (value._name == userConfig[config_user_peer].peerName) {
            peer = value
        }
    });
    Promise.resolve().then(() => {
        logger.info(chaincodeId)
        var transaction_id = client.newTransactionID();
        logger.info("Assigning transaction_id: ", transaction_id._transaction_id);
        request = {
            targets: [peer],
            chaincodeId: chaincodeId,
            txId: transaction_id,
            fcn: fcn,
            args: args
        };
        return channel.queryByChaincode(request);
    }).then((query_responses) => {
        logger.info("returned from query");
        if (!query_responses.length) {
            logger.info("No payloads were returned from query");
        } else {
            logger.info("Query result count = ", query_responses.length)
        }
        if (query_responses[0] instanceof Error) {
            logger.error("error from query = ", query_responses[0]);
            // let a = query_responses[0].details;
            response.data = query_responses[0];
            response.code = "800"
            res.end(JSON.stringify(response));
            return;
        }
        logger.info("Response is ", query_responses[0].toString());
        response.data = query_responses[0].toString();
        response.code = "200"
        res.end(JSON.stringify(response));
        return
    }).catch((err) => {
        logger.error("Caught Error", err);
        response.data = "Caught Error" + err.stack ? err.stack : err;
        response.code = "801"
        res.end(JSON.stringify(response));
        return "Caught Error" + err.stack ? err.stack : err;
    });
}
module.exports = query_chaincode;