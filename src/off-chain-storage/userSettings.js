import { pick } from 'ramda';
import { createEnhancedClient } from './utils';

const userSettingsTable = process.env.USER_SETTINGS_TABLE_NAME;

const { client } = createEnhancedClient();

const STORED_FIELDS = ['address', 'derivedAccountAddress', 'email', 'emailPreferences', 'fullName'];

export async function save(settings) {
  const data = await client
    .put({
      TableName: userSettingsTable,
      Item: pick(STORED_FIELDS, settings),
    })
    .promise();

  return data.Item;
}

export async function getByAddress(address) {
  const data = await client
    .get({
      TableName: userSettingsTable,
      Key: { address },
      AttributesToGet: STORED_FIELDS,
    })
    .promise();

  return data.Item;
}

export async function removeByAddress(address) {
  const data = await client
    .delete({
      TableName: userSettingsTable,
      Key: { address },
      ReturnValues: 'ALL_OLD',
    })
    .promise();

  return data.Attributes;
}
