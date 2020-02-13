'use strict';
const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();
const metricsHelper = require('./metricsHelper.js');
const metrics = process.env.METRICS;
const nodeUuid = require('uuid');
const uuid = nodeUuid.v4();

exports.main = (event, context, callback) => {

    console.log("Received event from Amazon Connect " + JSON.stringify(event));
    console.log('process.env.KvsStreamFunction', process.env.KvsStreamFunction)
    console.log('CASE ID: ', event.Details.ContactData.Attributes.CaseId)

    let payload = "";

    if (event.eventType) {
        payload = {
            inputFileName: "keepWarm.wav",
            connectContactId: "12b87d2b-keepWarm",
            transcriptionEnabled: "false"
        };
    } else {
        payload = {
            streamARN: event.Details.ContactData.MediaStreams.Customer.Audio.StreamARN,
            startFragmentNum: event.Details.ContactData.MediaStreams.Customer.Audio.StartFragmentNumber,
            connectContactId: event.Details.ContactData.ContactId,
            caseId: event.Details.ContactData.Attributes.CaseId
        };
    }

    console.log("Trigger event passed to KvsStreamFunction" + JSON.stringify(payload));

    const params = {
        // not passing in a ClientContext
        'FunctionName': process.env.KvsStreamFunction,
        // InvocationType is RequestResponse by default
        // LogType is not set so we won't get the last 4K of logs from the invoked function
        // Qualifier is not set so we use $LATEST
        'InvokeArgs': JSON.stringify(payload)
    };

    lambda.invokeAsync(params, function (err, data) {
        if (err) {
            sendAnonymousData("ERROR");
            throw (err);
        } else {
            console.log(JSON.stringify(data));
            sendAnonymousData("SUCCESS");
            if (callback)
                callback(null, buildResponse());
            else
                console.log('nothing to callback so letting it go');
        }
    });

    callback(null, buildResponse());
};

function buildResponse() {
    return {
        // we always return "Success" for now
        lambdaResult: "Success"
    };
}

// This function sends anonymous usage data, if enabled
function sendAnonymousData(response) {
    var event = {};
    event["Data"] = {};
    event["Data"]["KvsTriggerLambdaResult"] = response;
    event["UUID"] = uuid;
    event["Solution"] = "SO0064";
    var time = new Date();
    event["TimeStamp"] = time.toString();
    if (metrics == 'Yes') {
        let _metricsHelper = new metricsHelper();
        _metricsHelper.sendAnonymousMetric(event, function (err, data) {
            if (err) {
                console.log('Error sending anonymous metric:');
                console.log(err);
            } else {
                console.log('Success sending anonymous metric:');
                console.log(data);
            }
        });
    } else {
        console.log('Customer has elected not to send anonymous metrics');
    }
}