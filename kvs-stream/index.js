const {
    Decoder
} = require('ebml')
/* function that returns a promise to wait until the stream is done writing to the S3 bucket because tries to reduce the init time
lambda runs the same function that was already in memory or container.*/
const done  = (s) => {
    return new Promise ((resolve, reject) => {
        if (s.finished) {
            resolve()
        }
    })   
} 
let decoder
const { getAccessTokenandURI } = require('./sfdc-utils/accessTokenandURI')
const axios = require('axios')

const AWS = require("aws-sdk");
const s3 = new AWS.S3()

const BUCKET_NAME = process.env.Connect_VMS3BUCKET
const BUCKET_NAME_ERROR = process.env.Connect_VMS3BUCKET_ERROR
const AUDIO_MIME_TYPE = 'audio/x-wav'

let currentEBML = {}
currentEBML.Data = []
var currentContactID
var s3ObjectData = []

AWS.config.apiVersions = {
    kinesisvideo: '2017-09-30'
}
var kinesisvideo = new AWS.KinesisVideo({
    region: 'us-east-1'
})
var kinesisvideomedia = new AWS.KinesisVideoMedia({
    region: 'us-east-1'
})
var wavOutputStream
let wavBufferArray = []

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


//Entry point for this Lambda function:
exports.main = async (event) => {
    console.log('Event Received ==>', JSON.stringify(event, null, 2))
    let Writer = require('wav').Writer
    decoder = new Decoder()
    decoder.on('data', chunk => {
    const {
            name
        } = chunk[1];
        if (name === 'Block' || name === 'SimpleBlock') {
            wavBufferArray.push(chunk[1].payload)
        }
    })
    let streamARN = event.streamARN
    let startFragmentNum = event.startFragmentNum
    let caseId = event.caseId
    currentContactID = event.connectContactId
    let streamName = event.streamARN.substring(streamARN.indexOf("/") + 1, streamARN.lastIndexOf("/"))
    wavOutputStream = new Writer({
        sampleRate: 8000,
        channels: 1,
        bitDepth: 16
    });
    
    //Receive chunk data and push it to a simple Array
    wavOutputStream.on('data', (d) => {
        console.log('received data')
        s3ObjectData.push(d);
    });
    //Receive the end of the KVS chunk and process it
    wavOutputStream.on('finish', async () => {
        var params = {
            Bucket: BUCKET_NAME,
            Key: `${currentContactID}.wav`,
            Body: Buffer.concat(s3ObjectData),
            ContentType: AUDIO_MIME_TYPE,
        }
        //Write the wav file to S3
        var out = await s3.putObject(params).promise()
        console.log('S3 Result: ', JSON.stringify(out, null, 2))
        //Clear the cache
        s3ObjectData = []
        wavBufferArray = []
    })
    var params = {
        APIName: "GET_MEDIA",
        StreamName: streamName
    }
    var data = await kinesisvideo.getDataEndpoint(params).promise();
    kinesisvideomedia.endpoint = new AWS.Endpoint(data.DataEndpoint)

    try {
        await parseNextFragmentNew(streamARN, startFragmentNum, null);
        //waiting until the recorded stream 
        await done(wavOutputStream)
        console.log('Completely=======done');
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