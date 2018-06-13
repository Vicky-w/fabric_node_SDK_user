/**
 * Created by vickywang on 6/4/18
 */
'use strict';
var initHandler = require('./init');
var fs = require('fs');
var util = require('util');
var logger = require('log4js').getLogger("Invoke - Chaincode");


var invoke_chaincode = function (req, res) {
    var is_error = false;
    var tx_id = null;
    var response = {};
    var targets = [];
    var peers;
    var userConfig = initHandler.userConfig
    var client = initHandler.client
    var channel = initHandler.channel;
    var config_user_peer = initHandler.config_user_peer
    var config_target_peer = initHandler.config_target_peer
    var chaincodeId = req.body.chaincodeId;
    var channelName = req.body.channelName;
    var fcn = req.body.fcn;
    var args = req.body.args;
    var eh;
    var requests;
    var proposalResponses;
    Promise.resolve().then(() => {
        peers = channel.getPeers();
        peers.forEach(function (value, index, array) {
            if (value._name == userConfig[config_target_peer].peerName) {
                targets.push(value)
            }
        });
        tx_id = client.newTransactionID(true);
        logger.info("Assigning transaction_id: ", tx_id._transaction_id);
        requests = {
            targets: targets,
            chaincodeId: chaincodeId,
            fcn: fcn,
            args: args,
            chainId: channelName,
            txId: tx_id
        };
        return channel.sendTransactionProposal(requests);
    }).then((results) => {
        proposalResponses = results[0];
        var proposal = results[1];
        var header = results[2];
        let isProposalGood = false;
        if (proposalResponses && proposalResponses[0].response &&
            proposalResponses[0].response.status === 200) {
            isProposalGood = true;
            logger.info('transaction proposal was good');
        } else {
            logger.error('transaction proposal was bad');
        }
        if (isProposalGood) {
            logger.info(util.format(
                'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s"'
                // ', endorsement signature: %s'
                ,
                proposalResponses[0].response.status, proposalResponses[0].response.message
                , proposalResponses[0].response.payload
                // , proposalResponses[0].endorsement.signature
            ));
            var request = {
                proposalResponses: proposalResponses,
                proposal: proposal,
                header: header
            };
            var transactionID = tx_id.getTransactionID();
            var eventPromises = [];
            eh = client.newEventHub();
            let data = fs.readFileSync(userConfig[config_user_peer].peer_tls_cacerts);
            let grpcOpts = {
                pem: Buffer.from(data).toString(),
                'ssl-target-name-override': userConfig[config_user_peer].server_hostname
            }
            eh.setPeerAddr(userConfig[config_user_peer].event_url, grpcOpts);
            eh.connect();

            let txPromise = new Promise((resolve, reject) => {
                let handle = setTimeout(() => {
                    eh.disconnect();
                    response.status = "transaction Timeout";
                    response.code = "701"
                    is_error = true;
                    reject();
                }, 20000);
                eh.registerTxEvent(transactionID, (tx, code) => {
                    clearTimeout(handle);
                    eh.unregisterTxEvent(transactionID);
                    eh.disconnect();
                    if (code !== 'VALID') {
                        logger.error(
                            'The transaction was invalid, code = ' + code);
                        response.status = 'The transaction was invalid, code = ' + code;
                        response.code = "702"
                        is_error = true;
                        reject();
                    } else {
                        logger.info(
                            'The transaction has been committed on peer ' +
                            eh._ep._endpoint.addr);
                        resolve();
                    }
                });
            });
            eventPromises.push(txPromise);
            var sendPromise = channel.sendTransaction(request);
            return Promise.all([sendPromise].concat(eventPromises)).then((results) => {
                logger.info(' event promise all complete and testing complete');
                return results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
            }).catch((err) => {
                logger.error(
                    'Failed to send transaction and get notifications within the timeout period.'
                );
                if (eh && eh.isconnected()) {
                    logger.info('断开链接');
                    eh.disconnect();
                }
                response.status = "Failed to send transaction and get notifications within the timeout period.";
                response.code = "703"
                is_error = true
                return 'Failed to send transaction and get notifications within the timeout period.';
            });
        } else {
            logger.error(
                'Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...'
            );
            if (eh && eh.isconnected()) {
                logger.info('断开链接');
                eh.disconnect();
            }
            response.status = proposalResponses[0].details;
            response.code = "704"
            is_error = true;
            return 'Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...';
        }
    }, (err) => {
        logger.error('Failed to send proposal due to error: ' + err.stack ? err.stack : err);
        if (eh && eh.isconnected()) {
            logger.info('断开链接');
            eh.disconnect();
        }
        response.status = 'Failed to send proposal due to error: ' + err.stack ? err.stack : err;
        response.code = "705"
        is_error = true;
        return 'Failed to send proposal due to error: ' + err.stack ? err.stack : err;
    }).then((responses) => {
        if (responses.status === 'SUCCESS') {
            logger.info('Successfully sent transaction to the orderer.');
            if (eh && eh.isconnected()) {
                logger.info('断开链接');
                eh.disconnect();
            }
            response.status = responses.status;
            // response.metadata=responses.metadata;
            if (proposalResponses[0].response.payload != "" && proposalResponses[0].response.payload != null) {
                response.code = JSON.parse(proposalResponses[0].response.payload).code;
                response.msg = JSON.parse(proposalResponses[0].response.payload).msg;
            }
            if (response.code == 200) {
                is_error = false
            } else {
                is_error = true
            }
            return tx_id.getTransactionID();
        } else {
            logger.error('Failed to order the transaction. Error code: ' + responses.status);
            if (eh && eh.isconnected()) {
                logger.info('断开链接');
                eh.disconnect();
            }
            response.status = 'Failed to order the transaction. Error code: ' + responses.status;
            response.code = "706"
            is_error = true
            return 'Failed to order the transaction. Error code: ' + responses.status;
        }
    }, (err) => {
        logger.error('Failed to send transaction due to error: ' + err.stack ? err
            .stack : err);
        if (eh && eh.isconnected()) {
            logger.info('断开链接');
            eh.disconnect();
        }

        response.status = 'Failed to send transaction due to error: ' + err.stack ? err.stack : err;
        response.code = "707"
        is_error = true
        return 'Failed to send transaction due to error: ' + err.stack ? err.stack : err;
    }).then(() => {


        if (is_error == true) {
            initHandler.connection.query(initHandler.insert_log_sql, [response.status, JSON.stringify(requests.args), fcn], function (error, results, fields) {
                if (error) {
                    logger.error("\n       *****************************************************************************\n"
                        + "       *                                        \n"
                        + "       *     mysql log======   " + error.code + "  \n"
                        + "       *    " + JSON.stringify(response) + "         \n"
                        + "       *                                        \n"
                        + "       *****************************************************************************\n");
                    response.dbcode = "710"
                    response.dbstatus = error.code
                    res.end(JSON.stringify(response));
                    // throw error
                    return
                } else {
                    logger.info("mysql log======   Insert Success")
                    response.dbcode = "200"
                    response.dbstatus = "Insert Success"
                    res.end(JSON.stringify(response));
                    return
                }
            });
        } else {
            res.end(JSON.stringify(response));
            return
        }
    });

}

module.exports = invoke_chaincode;