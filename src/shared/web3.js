import Web3 from 'web3';

export const CHAIN_ID = process.env.CHAIN_ID ?? '77';

const web3 = new Web3(process.env.JSON_RPC_URL);

export default web3;

const REORG_SAFETY_BUFFER = 20;

export async function getLatestBlockNumber() {
  return Number(await web3.eth.getBlockNumber()) - REORG_SAFETY_BUFFER;
}
