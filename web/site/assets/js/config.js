/* Barge site settings. Empty values stay hidden until launch. */
window.BARGE_CONFIG = {
  ca: '', // $BARGE contract address on Robinhood Chain, set at launch
  x: 'https://x.com/usebarge', // X profile URL
  lineage: '0x34b304202f43f86d01c0716cC5244eDd390166A9', // BargeLineage contract on Robinhood Chain
  passport: '0x3Fc6c58c800E643404084E97B49E9E9554Bbdb55', // BargePassport contract on Robinhood Chain
  holdBps: 10,           // holder badge threshold, in basis points of supply (10 = 0.1%)
  chainId: 4663,
  chainName: 'Robinhood Chain',
  rpc: 'https://rpc.mainnet.chain.robinhood.com',
  explorer: 'https://robinhoodchain.blockscout.com',
  tradeUrl: 'https://ponsfamily.com/launchpad/{ca}',
  chartUrl: 'https://dexscreener.com/robinhood/{ca}',
  explorerUrl: 'https://robinhoodchain.blockscout.com/token/{ca}'
};
