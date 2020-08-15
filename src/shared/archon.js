import Archon from '@kleros/archon';
import web3 from './web3';

export default new Archon(web3.currentProvider, process.env.IPFS_GATEWAY_ADDRESS);
