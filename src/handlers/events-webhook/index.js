import { notifyFromEvent } from '~/services/email-notifications';

export async function receiveEvent(triggerEvent) {
  const event = JSON.parse(triggerEvent.body);

  if (!event) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          message: 'No event log passed in body.',
        },
      }),
    };
  }

  try {
    await notifyFromEvent(event);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        data: {
          message: 'Event sucessfully processed.',
        },
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          message: 'Failed to process event',
        },
      }),
    };
  }
}
