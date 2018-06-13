/**
 * Created by vickywang on 6/5/18
 */
var path = require('path');
var fs = require('fs');
var mysql = require('mysql');
var Client = require('../base/fabric-client');
var sdkUtils = require('../base/fabric-client/lib/utils.js');
var tempdir = path.join('./hfc');
var logger = require('log4js').getLogger("init - Blockchain");
// var logger = initlogger.setLogger("init - Blockchain");


var config_orderer = "orderer1";
// var config_orderer = "orderer2";
var config_target_peer = "peer0-endorsement";
// var config_target_peer = "pee1";
// var config_user_peer = "peer0-endorsement";
var config_user_peer = "pee1";
logger.info("************************************************************");
logger.info("********init*******tempdir=========== " + tempdir + "  **********");
logger.info("************************************************************");
var client = new Client();
var channel;
var connection;
var userConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config', 'user-config.json')));
var dbConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config', 'db-config.json')));
var init_handler = {};

let insert_log_sql = 'INSERT INTO test(log,requests,function) values(?,?,?)';


const getKeyFilesInDir = (dir) => {
    var files = fs.readdirSync(dir)
    var keyFiles = []
    files.forEach((file_name) => {
        let filePath = path.join(dir, file_name)
        if (file_name.endsWith('_sk')) {
            keyFiles.push(filePath)
        }
    })
    return keyFiles
}

Promise.resolve().then(() => {

    connection = mysql.createConnection(dbConfig.db);
    connection.connect(function (err) {
        if (err) throw err;
        logger.info('connected as id ' + connection.threadId);
    });

    logger.info("mysql connected");


    var createUserOpt = {
        username: userConfig[config_user_peer].user_id,
        mspid: userConfig[config_user_peer].msp_id,
        cryptoContent: {
            privateKey: getKeyFilesInDir(userConfig[config_user_peer].privateKeyFolder)[0],
            signedCert: userConfig[config_user_peer].signedCert
        }
    }
    return sdkUtils.newKeyValueStore({
        path: path.join(tempdir, 'hfc-test-kvs') + '_' + userConfig[config_user_peer].org
    }).then((store) => {
        client.setStateStore(store)
        return client.createUser(createUserOpt)
    })
}).then((user) => {
    channel = client.newChannel(userConfig[config_user_peer].channel_id);
    let data1 = fs.readFileSync(userConfig[config_target_peer].peer_tls_cacerts);
    let peer1 = client.newPeer(userConfig[config_target_peer].peer_url,
        {
            pem: Buffer.from(data1).toString(),
            'ssl-target-name-override': userConfig[config_target_peer].server_hostname
        }
    );
    peer1.setName(userConfig[config_target_peer].peerName);
    channel.addPeer(peer1);
    logger.info("create  " + userConfig[config_target_peer].peerName)
    if (config_user_peer != config_target_peer) {
        let data2 = fs.readFileSync(userConfig[config_user_peer].peer_tls_cacerts);
        let peer2 = client.newPeer(userConfig[config_user_peer].peer_url,
            {
                pem: Buffer.from(data2).toString(),
                'ssl-target-name-override': userConfig[config_user_peer].server_hostname
            }
        );
        peer2.setName(userConfig[config_user_peer].peerName);
        channel.addPeer(peer2);
        logger.info("create " + userConfig[config_user_peer].peerName)
    }
    let odata = fs.readFileSync(userConfig[config_orderer].orderer_tls_cacerts);
    let caroots = Buffer.from(odata).toString();
    let orderer = client.newOrderer(userConfig[config_orderer].orderer_url, {
        'pem': caroots,
        'ssl-target-name-override': userConfig[config_orderer].orderer_hostname
    });
    channel.addOrderer(orderer);
    logger.info("create orderer1")
    logger.info("create orderer1 logger log")

    init_handler.client = client;
    init_handler.channel = channel;
    init_handler.userConfig = userConfig;
    init_handler.config_user_peer = config_user_peer
    init_handler.config_target_peer = config_target_peer
    init_handler.connection = connection
    init_handler.insert_log_sql = insert_log_sql
    return;
})


module.exports = init_handler;
