import IArbitrator from '@kleros/erc-792/build/contracts/IArbitrator.json';
import Linguo from '@kleros/linguo-contracts/artifacts/Linguo.json';
import {
  andThen,
  compose,
  curry,
  flatten,
  fromPairs,
  indexBy,
  map,
  path,
  pipeWith,
  toPairs,
  uniq,
  values,
} from 'ramda';
import createBatchSend from 'web3-batched-send';
import * as P from '~/shared/promise';
import web3, { CHAIN_ID } from '~/shared/web3';
import createApiInstance from './createApiInstance';

const TX_BATCHER_CONTRACT_ADDRESSES = JSON.parse(process.env.TX_BATCHER_CONTRACT_ADDRESSES ?? '{}');
const txBatcherContractAddress = TX_BATCHER_CONTRACT_ADDRESSES[CHAIN_ID];

const DEBOUNCE_PERIOD = 10000; // milliseconds

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

export async function createApiInstancesByAddress({ account }) {
  const createContract = curry(function createContract(abi, address) {
    return new web3.eth.Contract(abi, address, { from: account.address });
  });

  const contractAddresses = flatten(values(JSON.parse(process.env.LINGUO_CONTRACT_ADDRESSES ?? {})[CHAIN_ID]));
  const indexByAddress = indexBy(path(['options', 'address']));

  const contractsByAddress = compose(indexByAddress, map(createContract(Linguo.abi)), uniq)(contractAddresses);

  const batchSend = createBatchSend(web3, txBatcherContractAddress, account.privateKey, DEBOUNCE_PERIOD);

  return asyncPipe([
    toPairs,
    P.map(async ([address, linguo]) => [
      address,
      createApiInstance({
        linguo,
        arbitrator: createContract(IArbitrator.abi, await linguo.methods.arbitrator().call()),
        batchSend,
      }),
    ]),
    fromPairs,
  ])(contractsByAddress);
}
