import { fork, put } from 'redux-saga/effects';
import {
  ffsConnected,
  dbConnected,
  spaceDaemonConnected,
  secretConnected,
} from './actions';
import { createPow } from '@textile/powergate-client';
import { Client, KeyInfo, ThreadID } from '@textile/hub';
import { Libp2pCryptoIdentity } from '@textile/threads-core';
import { SpaceClient } from '@fleekhq/space-client';
import { FileSchema } from './schemas';
import { encodeSecp256k1Pubkey, pubkeyToAddress, Secp256k1Pen } from 'secretjs';
import { StdSignature } from 'secretjs/types/types';
import { Bip39, Random } from '@iov/crypto';

const {
  REACT_APP_POW_HOST,
  REACT_APP_SPACE_HOST,
  REACT_APP_POW_TOKEN,
  REACT_APP_DB_USER_API_KEY,
  REACT_APP_DB_USER_API_SECRET,
} = process.env;

async function getIdentity() {
  const cachedIdentity = localStorage.getItem('user-private-identity');
  if (cachedIdentity !== null) {
    return Libp2pCryptoIdentity.fromString(cachedIdentity);
  }
  const identity = await Libp2pCryptoIdentity.fromRandom();
  localStorage.setItem('user-private-identity', identity.toString());
  return identity;
}

async function getSecretWallet() {
  const cachedWallet = localStorage.getItem('user-secret-wallet');
  if (cachedWallet !== null) {
    const res = JSON.parse(cachedWallet);
    res.signer = eval(res.signer);
    return res;
  }
  const mnemonic = Bip39.encode(Random.getBytes(16)).toString();
  const pen = await Secp256k1Pen.fromMnemonic(mnemonic);
  const pubkey = encodeSecp256k1Pubkey(pen.pubkey);
  const address = pubkeyToAddress(pubkey, 'secret');
  const signer = (signBytes: Uint8Array): Promise<StdSignature> =>
    pen.sign(signBytes);

  const wallet = { address, signer };
  localStorage.setItem(
    'user-secret-wallet',
    JSON.stringify(wallet, function (key, value) {
      if (typeof value === 'function') {
        return value.toString();
      } else {
        return value;
      }
    })
  );
  return wallet;
}

function* init() {
  const pow = createPow({ host: REACT_APP_POW_HOST });
  pow.setToken(REACT_APP_POW_TOKEN as string);
  const { ffs } = pow;
  yield put(ffsConnected(ffs));

  const keyInfo: KeyInfo = {
    // Using insecure keys
    key: REACT_APP_DB_USER_API_KEY as string,
    secret: REACT_APP_DB_USER_API_SECRET as string,
    // @ts-ignore
    type: 1,
  };
  const db: Client = yield Client.withKeyInfo(keyInfo);
  // TODO: use MetaMask to generate identity instead of Libp2pCryptoIdentity
  const identity: Libp2pCryptoIdentity = yield getIdentity();
  yield db.getToken(identity);
  const { listList: threads } = yield db.listThreads();
  if (threads.length === 0) {
    yield db.newDB();
  }
  const threadId = (yield db.listThreads()).listList[0].id;
  const thread: ThreadID = yield ThreadID.fromString(threadId as string);
  try {
    yield db?.getCollectionIndexes(thread, 'files');
  } catch (e) {
    yield db?.newCollection(thread, 'files', FileSchema);
  }
  yield put(dbConnected(db, thread));

  // get secret wallet
  const secretWallet = yield getSecretWallet();
  yield put(secretConnected(secretWallet.address));

  // default port exposed by the daemon for client connection is 9998
  const spaceClient = new SpaceClient({
    url: REACT_APP_SPACE_HOST as string,
  });
  yield put(spaceDaemonConnected(spaceClient));
}

function* saga() {
  yield fork(init);
}

export default saga;

// Snippets:
// // Generate new thread
// const thread: ThreadID = yield client.newDB()

// // Delete all threads
// for (const thread of (yield client.listThreads()).listList) {
//     client.deleteDB(ThreadID.fromString(thread.id))
// }
