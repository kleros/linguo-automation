import web3 from '~/shared/web3';
import { getDefaultAccount } from '~/shared/account';

export default async function getUnsubscribeSignerAccount() {
  const botAccount = await getDefaultAccount();
  const { signature } = await botAccount.sign(process.env.MESSAGE_SIGNER_ACCOUNT_SEED);
  const privateKey = web3.utils.keccak256(signature);

  return web3.eth.accounts.privateKeyToAccount(privateKey);
}
