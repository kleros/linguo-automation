import * as UserSettings from '~/off-chain-storage/userSettings';

export default async function getUserSettings({ web3, payload }) {
  const { address, message, signature } = payload;

  let recoveredAddress;

  try {
    recoveredAddress = web3.eth.accounts.recover(message, signature);
  } catch (err) {
    throw new Error('Invalid signature!');
  }

  const data = await UserSettings.getByAddress(address);

  if (recoveredAddress !== data.derivedAccountAddress) {
    throw new Error('Signature does not match derived account address!');
  }

  return data;
}
