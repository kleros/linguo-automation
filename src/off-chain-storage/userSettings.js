import { createEnhancedClient } from './utils';

const { client } = createEnhancedClient();

const userSettingsTable = process.env.USER_SETTINGS_TABLE_NAME;

export async function save(settings) {
  const data = await client
    .put({
      TableName: userSettingsTable,
      Item: settings,
    })
    .promise();

  return data.Item;
}

export async function getByAddress(address) {
  const data = await client
    .get({
      TableName: userSettingsTable,
      Key: { address },
      AttributesToGet: ['address', 'derivedAccountAddress', 'email', 'fullName', 'preferences'],
    })
    .promise();

  return data.Item;
}
