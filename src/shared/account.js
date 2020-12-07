import { S3 } from 'aws-sdk';
import web3 from './web3';

const s3 = new S3();

export async function getDefaultAccount() {
  const firstAccount = web3.eth.accounts.wallet[0];

  if (firstAccount) {
    return firstAccount;
  }

  const privateKey = await getPrivateKey();

  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  web3.eth.accounts.wallet.add(account);

  return account;
}

async function getPrivateKey() {
  const data = await s3
    .getObject({
      Bucket: 'kleros-bots-private-keys',
      Key: 'linguo.json',
    })
    .promise();

  const { privateKey } = JSON.parse(data.Body?.toString('utf8') ?? '{}');
  return privateKey;
}
