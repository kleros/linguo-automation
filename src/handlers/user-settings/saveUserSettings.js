import * as UserSettings from '~/off-chain-storage/userSettings';

export default async function saveUserSettings({ web3, payload }) {
  const { address, derivedAccountAddress, message, signature } = payload;

  let recoveredAddress;

  try {
    recoveredAddress = web3.eth.accounts.recover(message, signature);
  } catch (err) {
    throw new Error('Invalid signature!');
  }

  if (recoveredAddress !== derivedAccountAddress) {
    throw new Error('Signature does not match derived account address!');
  }

  const data = JSON.parse(message);

  const settings = { address, derivedAccountAddress, ...data };
  await UserSettings.save(settings);

  return settings;
}
