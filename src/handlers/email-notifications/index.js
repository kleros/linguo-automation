import { compose, map, prop } from 'ramda';
import * as P from '~/shared/promise';
import { notifyFromEvent, unsubscribe } from '~/services/email-notifications';

export async function receiveEvent(evt) {
  const events = map(compose(JSON.parse, prop('Message'), JSON.parse, prop('body')), evt.Records);
  console.info(JSON.stringify({ events }, null, 2), 'Got events to process e-mail notifications');

  const result = await P.map(notifyFromEvent, events);
  console.info(JSON.stringify(result, null, 2), 'Successfully processed e-mail notifications');

  return result;
}

export async function receiveUnsubscription(event) {
  const { message, token } = event.queryStringParameters ?? {};

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
