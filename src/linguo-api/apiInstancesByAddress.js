import Linguo from '@kleros/linguo-contracts/artifacts/Linguo.json';
import createBatchSend from 'web3-batched-send';
import { compose, curry, flatten, indexBy, map, path, uniq, values } from 'ramda';
import web3, { CHAIN_ID } from '~/shared/web3';
import createApiInstance from './createApiInstance';

const TX_BATCHER_CONTRACT_ADDRESSES = JSON.parse(process.env.TX_BATCHER_CONTRACT_ADDRESSES ?? '{}');
const txBatcherContractAddress = TX_BATCHER_CONTRACT_ADDRESSES[CHAIN_ID];

const DEBOUNCE_PERIOD = 10000; // milliseconds

export function createApiInstancesByAddress({ account }) {
  const createLinguoContract = curry(function createContract(abi, address) {
    return new web3.eth.Contract(abi, address, { from: account.address });
  });

  const contractAddresses = flatten(values(JSON.parse(process.env.LINGUO_CONTRACT_ADDRESSES ?? {})[CHAIN_ID]));
  const indexByAddress = indexBy(path(['options', 'address']));

  const contractsByAddress = compose(indexByAddress, map(createLinguoContract(Linguo.abi)), uniq)(contractAddresses);

  const batchSend = createBatchSend(web3, txBatcherContractAddress, account.privateKey, DEBOUNCE_PERIOD);

  return map(
    linguo =>
      createApiInstance({
        linguo,
        batchSend,
      }),
    contractsByAddress
  );
}
