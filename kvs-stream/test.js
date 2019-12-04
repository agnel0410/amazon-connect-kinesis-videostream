const fs = require('fs')
const {
    Decoder
} = require('ebml');
const decoder = new Decoder();
const Writer = require('wav').Writer;

const AWS = require("aws-sdk");
const s3 = new AWS.S3();

const BUCKET_NAME = 'connect-sharing-4444-cab-agnel-14567';
const AUDIO_MIME_TYPE = 'audio/x-wav';

let currentEBML = {};
currentEBML.Data = [];
var currentContactID;

AWS.config.apiVersions = {
    kinesisvideo: '2017-09-30'
};

var kinesisvideo = new AWS.KinesisVideo({
    region: 'us-east-1'
});
var kinesisvideomedia = new AWS.KinesisVideoMedia({
    region: 'us-east-1'
});

var wavOutputStream;

let wavBufferArray = [];

decoder.on('data', chunk => {
    const {
        name
    } = chunk[1];
    if (name === 'Block' || name === 'SimpleBlock') {
        wavBufferArray.push(chunk[1].payload)
    }
});

decoder.on('finish', () => {
    //TODO;
})
decoder.on('error', () => {
    //TODO 
});

async function parseNextFragmentNew(streamArn, fragmentNumber, contToken) {
    var paramsData = {
        StartSelector: {
            StartSelectorType: "FRAGMENT_NUMBER",
            AfterFragmentNumber: fragmentNumber,
        },
        StreamName: streamArn.split('/')[1]
    };
    return new Promise((resolve, reject) => {
        var listener = AWS.EventListeners.Core.HTTP_DATA;
        var request = kinesisvideomedia.getMedia(paramsData);
        request.removeListener('httpData', listener);
        request.on('httpData', function (chunk, response) {
            decoder.write(chunk)
        });
        request.on('httpDone', function (response) {
            wavOutputStream.write(Buffer.concat(wavBufferArray));
            wavOutputStream.end();
            console.log('=======done');
            resolve({});
        });
        request.send();
    });
}



exports.main = async (event) => {
    var args = event.Details.Parameters;
    console.log('Event Received ==>', JSON.stringify(event, null, 2))
    let streamARN = event.streamARN
    let startFragmentNum = event.startFragmentNum
    currentContactID = event.connectContactId
    let streamName = event.streamARN.substring(streamARN.indexOf("/") + 1, streamARN.lastIndexOf("/"))
    wavOutputStream = new Writer({
        sampleRate: 8000,
        channels: 1,
        bitDepth: 16
    });
    var s3ObjectData = [];
    //Receive chunk data and push it to the Array
    wavOutputStream.on('data', (d) => {
        s3ObjectData.push(d);
    });
    //Receive the end of the KVS chunk
    wavOutputStream.on('end', async () => {
        var params = {
            Bucket: BUCKET_NAME,
            Key: `${currentContactID}.wav`,
            Body: Buffer.concat(s3ObjectData),
            ContentType: AUDIO_MIME_TYPE,
        };
        var out = await s3.putObject(params).promise();
        console.log('S3 Result: ', JSON.stringify(out, null, 2))
    });


    var params = {
        APIName: "GET_MEDIA",
        StreamName: streamName
    };
    var data = await kinesisvideo.getDataEndpoint(params).promise();
    kinesisvideomedia.endpoint = new AWS.Endpoint(data.DataEndpoint)

    try {
        await parseNextFragmentNew(streamARN, startFragmentNum, null);
    } catch (e) {
        console.log(e.message, e.stack);
    }

    const response = {
        statusCode: 200,
        body: {
            status: 'done'
        },
    };
    return response;
};
