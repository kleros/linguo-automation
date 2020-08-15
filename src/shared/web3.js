import Web3 from 'web3';

const rpcEndpoints = {
  1: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
  42: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
};

export const CHAIN_ID = process.env.CHAIN_ID ?? '42';

const web3 = new Web3(new Web3.providers.HttpProvider(rpcEndpoints[CHAIN_ID]));

export default web3;
