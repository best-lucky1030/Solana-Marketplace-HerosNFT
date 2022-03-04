import * as anchor from '@project-serum/anchor';
import FormData from 'form-data';
import fs from 'fs';
import log from 'loglevel';
import fetch from 'node-fetch';
import { ARWEAVE_PAYMENT_WALLET } from '../constants';
import { sendTransactionWithRetryWithKeypair } from '../transactions';

async function upload(data: FormData,/* manifest, */index) {
  log.debug(`trying to upload ${index}`);//: ${manifest.name}`);
  return await (
    await fetch(
      'https://us-central1-principal-lane-200702.cloudfunctions.net/uploadFile4',
      {
        method: 'POST',
        // @ts-ignore
        body: data,
      },
    )
  ).json();
}

export async function arweaveUpload(
  connection,
  walletKeyPair,
  // anchorProgram,
  env,
  image,
  // manifestBuffer,
  // manifest,
  name,
) {
  const storageCost = 2300000; // 0.0023 SOL per file (paid to arweave)

  const instructions = [
    anchor.web3.SystemProgram.transfer({
      fromPubkey: walletKeyPair.publicKey,
      toPubkey: ARWEAVE_PAYMENT_WALLET,
      lamports: storageCost,
    }),
  ];

  const tx = await sendTransactionWithRetryWithKeypair(
    connection,
    walletKeyPair,
    instructions,
    [],
    'single',
  );
  log.debug('transaction for arweave payment:', tx);

  const manifestBuffer = Buffer.from('Anything').toString('base64');
  const data = new FormData();
  data.append('transaction', tx['txid']);
  data.append('env', env);
  data.append('file[]', fs.createReadStream(image), {
    filename: `image.png`,
    contentType: 'image/png',
  });
  data.append('file[]', manifestBuffer, 'metadata.json');

  const result = await upload(data,/* manifest, */name);

  const metadataFile = result.messages?.find(
    m => m.filename === 'image.png',
  );
  if (metadataFile?.transactionId) {
    const link = `https://arweave.net/${metadataFile.transactionId}`;
    log.debug(`File uploaded: ${link}`);
    return link;
  } else {
    // @todo improve
    throw new Error(`No transaction ID for upload: ${name}`);
  }
}

export async function arweaveMetaUpload(
  walletKeyPair,
  connection,
  env,
  // image,
  manifestBuffer,
  manifest,
  index,
) {
  const storageCost = 2300000; // 0.0023 SOL per file (paid to arweave)

  const instructions = [
    anchor.web3.SystemProgram.transfer({
      fromPubkey: walletKeyPair.publicKey,
      toPubkey: ARWEAVE_PAYMENT_WALLET,
      lamports: storageCost,
    }),
  ];

  const tx = await sendTransactionWithRetryWithKeypair(
    connection,
    walletKeyPair,
    instructions,
    [],
    'single',
  );
  log.debug('transaction for arweave payment:', tx);
  const image = __dirname + '\\..\\..\\meta_image.png';
  const data = new FormData();
  data.append('transaction', tx['txid']);
  data.append('env', env);
  data.append('file[]', fs.createReadStream(image), {
    filename: `meta_image.png`,
    contentType: 'image/png',
  });
  data.append('file[]', manifestBuffer, 'metadata.json');
  const result = await upload(data, manifest);
  log.info(result);
  const metadataFile = result.messages?.find(
    m => m.filename === 'manifest.json',
  );
  if (metadataFile?.transactionId) {
    const link = `https://arweave.net/${metadataFile.transactionId}`;
    log.debug(`File uploaded: ${link}`);
    return link;
  } else {
    // @todo improve
    throw new Error(`No transaction ID for upload: ${index}`);
  }
}
