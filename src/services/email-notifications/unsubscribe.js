import { getByAddress, save } from '~/off-chain-storage/userSettings';
import web3 from '~/shared/web3';
import getUnsubscribeSignerAccount from './getUnsubscribeSignerAccount';

export default async function unsubscribe({ message, token }) {
  const signerAccount = await getUnsubscribeSignerAccount();

  let recoveredAddress;
  try {
    recoveredAddress = web3.eth.accounts.recover(message, token);
  } catch {
    throw new Error('Invalid token!');
  }

  if (recoveredAddress !== signerAccount.address) {
    throw new Error('Invalid token!');
  }

  let payload;
  try {
    payload = JSON.parse(message);
  } catch {
    throw new Error('Invalid message:', message);
  }

  const settings = await getByAddress(payload.address);

  if (settings?.email !== payload?.email) {
    throw new Error('Subscription not found.');
  }

  await save({ ...settings, emailPreferences: {} });

  return 'You were successfully unsubscribed!';
}
