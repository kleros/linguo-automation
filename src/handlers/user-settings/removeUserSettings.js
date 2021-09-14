import * as UserSettings from '~/off-chain-storage/userSettings';

export default async function removeUserSettings({ web3, payload }) {
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

  await UserSettings.removeByAddress(address);

  return { address };
}
