const {
    Decoder
} = require('ebml');
const decoder = new Decoder();
const Writer = require('wav').Writer;

const AWS = require("aws-sdk");
const s3 = new AWS.S3();


let currentEBML = {};
const BUCKET_NAME = 'connect-sharing-4444-cab-agnel-14567';
const AUDIO_MIME_TYPE = 'audio/x-wav';
var currentContactID = '';
currentEBML.Data = [];

AWS.config.apiVersions = {
    kinesisvideo: '2017-09-30'
};
var s3Object;
var kinesisvideo = new AWS.KinesisVideo({
    region: 'us-east-1'
});
var kinesisvideomedia = new AWS.KinesisVideoMedia({
    region: 'us-east-1'
});
var wavOutputStream = new Writer({
    sampleRate: 8000,
    channels: 1,
    bitDepth: 16
});
var wavBufferArray = [];
var s3Object;
wavOutputStream.on('data', function (d) {
    console.log('Push Data', d)
    wavBufferArray.push(d)
    console.log(`Pushed data into array `)
})
wavOutputStream.on('end', async () => {
    var params = {
        Bucket: BUCKET_NAME,
        Key: `${currentContactID}.wav`,
        Body: Buffer.concat(wavBufferArray),
        ContentType: AUDIO_MIME_TYPE,
    };
    var out = await s3.putObject(params).promise();
    console.log('S3 Result: ', JSON.stringify(out, null, 2))

});
var count = 0;
decoder.on('data', chunk => {
    const {
        name
    } = chunk[1];
    if (name === 'Block' || name === 'SimpleBlock') {
        console.log('Received this chunk', chunk[1].payload.toString('hex'))
        try {
            wavOutputStream.write(chunk[1].payload.toString('hex'));
        } catch (e) {
            console.log(e)
        }
        
        count++;
    }
})
decoder.on('finish', () => {
    console.log('Done');
    wavOutputStream.end();
})
decoder.on('error', () => {
    console.log('Zut');
    const response = {
        statusCode: 200,
        body: 'Keep rolling',
    };
    return response;
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
        // A request listener that reads data from the http connection
        let listener =AWS.EventListeners.Core.HTTP_DATA;
        let request = kinesisvideomedia.getMedia(
            paramsData
        )
        request.removeListener("httpData",listener)
        request.on("httpData", function (chunk, response) {
            console.log("Inside request.on received chunk")
            decoder.write(chunk)
        });
        //A request listener that initiates the HTTP connection for a request being sent
        request.send();
    });

}



exports.main = async (event) => {
    console.log("Received event from Amazon Connect")
    console.log('Event Received ==>', JSON.stringify(event, null, 2))
    let streamARN = event.streamARN
    let startFragmentNum = event.startFragmentNum
    currentContactID = event.connectContactId
    let streamName = streamARN.substring(streamARN.indexOf("/") + 1, streamARN.lastIndexOf("/"))

    /* event.Details.Parameters contains the following attibutes sent from the ContactFlow
    p_streamArn,
    p_streamStartTimeStamp,
    p_streamStartFragNum
    */

    var params = {
        APIName: "GET_MEDIA",
        StreamName: streamName
    };
    //Important: Gets the endpoint for a specified stream for reading:
    var data = await kinesisvideo.getDataEndpoint(params).promise();
    kinesisvideomedia.endpoint = new AWS.Endpoint(data.DataEndpoint)

    try {
        await parseNextFragmentNew(streamARN, startFragmentNum, null);
    } catch (e) {
        console.log(e.message, e.stack);
    }

    // This is a dummy response 
    // it should correspond to what your ContactFlow is expecting back

    const response = {
        statusCode: 200,
        body: 'Keep rolling',
    };
    return response;
};