import { Linguo, LinguoToken } from '@kleros/contract-deployments/linguo';
import createBatchSend from 'web3-batched-send';
import { compose, curry, indexBy, map, mergeAll, path, pluck, uniq, values } from 'ramda';
import web3, { CHAIN_ID } from '~/shared/web3';
import createApiInstance from './createApiInstance';

const TX_BATCHER_CONTRACT_ADDRESSES = JSON.parse(process.env.TX_BATCHER_CONTRACT_ADDRESSES ?? '{}');
const txBatcherContractAddress = TX_BATCHER_CONTRACT_ADDRESSES[CHAIN_ID];

const DEBOUNCE_PERIOD = 10000; // milliseconds

export function createApiInstancesByAddress({ account }) {
  const createLinguoContract = curry(function createContract(abi, address) {
    return new web3.eth.Contract(abi, address, { from: account.address });
  });

  const contractAddresses = values(JSON.parse(process.env.LINGUO_CONTRACT_ADDRESSES ?? {})[CHAIN_ID]);
  const indexByAddress = indexBy(path(['options', 'address']));

  const linguoContractsByAddress = compose(
    indexByAddress,
    map(createLinguoContract(Linguo.abi)),
    uniq,
    pluck('linguo')
  )(contractAddresses);

  const linguoTokenContractsByAddresses = compose(
    indexByAddress,
    map(createLinguoContract(LinguoToken.abi)),
    uniq,
    pluck('linguoToken')
  )(contractAddresses);

  const contractsByAddress = mergeAll([linguoContractsByAddress, linguoTokenContractsByAddresses]);

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
