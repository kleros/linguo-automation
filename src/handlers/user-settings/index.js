import web3 from '~/shared/web3';
import { unsubscribe } from '~/services/email-notifications';
import getUserSettingsHandler from './getUserSettings';
import saveUserSettingsHandler from './saveUserSettings';

export async function saveUserSettings(event) {
  const { address } = event.pathParameters;
  const body = JSON.parse(event.body);

  try {
    const data = await saveUserSettingsHandler({ web3, payload: { address, ...body } });
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ data }),
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: { message: err.message } }),
    };
  }
}

export async function getUserSettings(event) {
  const { address } = event.pathParameters;
  const qsParams = event.queryStringParameters;

  try {
    const data = await getUserSettingsHandler({ web3, payload: { address, ...qsParams } });
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ data }),
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: { message: err.message } }),
    };
  }
}

export async function receiveUnsubscription(event) {
  const { message, token } = event.queryStringParameters;

  try {
    const result = await unsubscribe({ message, token });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/html',
      },
      body: simpleHtmlTemplate({
        title: 'Linguo | Unsubscribe',
        body: `<p>${result}</p>`,
        styles: `
          body {
            color: darkgreen;
          }`,
      }),
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/html',
      },
      body: simpleHtmlTemplate({
        title: 'Linguo | Error in unsubscription',
        body: `<p>${err.message}</p>`,
        styles: `
          body {
            color: darkred;
          }`,
      }),
    };
  }
}

function simpleHtmlTemplate({ title, styles = '', body = '' }) {
  return `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <title>${title}</title>
            <meta name="viewport" content="width=device-width" />
            <link rel="shortcut icon" href="https://ipfs.kleros.io/ipfs/QmP3u3z2YEFFP6ayuqZEk7jWEHHqHKygXqaKbPYzLnc1Ey/avatar-linguo-bot-512.png" type="image/x-icon" />
            <link href="https://fonts.googleapis.com/css?family=Roboto:400,500,700&display=swap" rel="stylesheet" />
            <style>
              body {
                font-family: 'Roboto', sans-serif;
              }
              ${styles}
            </style>
          </head>
          <body>
            ${body}
          </body>
        </html>
      `;
}
