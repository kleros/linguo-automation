import web3 from '~/shared/web3';
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
