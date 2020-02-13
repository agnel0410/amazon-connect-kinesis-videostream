const axios = require('axios')

const getAccessTokenandURI = async () => {
  try{
    let sfHost = process.env.SF_PRODUCTION.toLowerCase() === 'true' ? 'https://login.salesforce.com' : process.env.SF_HOST;
    console.log('Getting access token from SFDC.......')
    let sfdcAuthUrl = `${sfHost}/services/oauth2/token?grant_type=password&client_id=${process.env.SF_CONSUMER_KEY}&client_secret=${process.env.SF_CONSUMER_SECRET}&username=${process.env.SF_USERNAME}&password=${process.env.SF_PASSWORD}`
    console.log('sfdcAuthUrl: ' + sfdcAuthUrl)
    let result = await axios({
      method: 'post',
      url: sfdcAuthUrl,
      headers: {
        'content-type': 'application/json'
      }
    })
    // console.log(`response code from SFDC for access token: ${result.status}`)
    console.log(`access_token ${result.data.access_token} issued at ${result.data.issued_at}`)
    let attachmentUrl = `${result.data.instance_url}/services/data/${process.env.SF_VERSION}/sobjects/Attachment`
    let authorization = `${result.data.token_type} ${result.data.access_token}`
    return ({ attachmentUrl, authorization })
  } catch (e){
      console.log(`Error from SFDC Auth API with status code: ${e.response.status} and message: ${e.response.data.error_description}`)
      throw new Error({
        status: e.response.status,
        message: e.response.data.error_description
    })
  }
}


module.exports = { getAccessTokenandURI }

