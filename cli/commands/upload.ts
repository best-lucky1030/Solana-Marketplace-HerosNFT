import { EXTENSION_PNG, EXTENSION_JPG } from '../helpers/constants';
import path from 'path';
import {
  loadWalletKey,
} from '../helpers/accounts';
import {
  Connection, Keypair
} from '@solana/web3.js';
import log from 'loglevel';
import { awsUpload } from '../helpers/upload/aws';
import { arweaveUpload, arweaveMetaUpload } from '../helpers/upload/arweave';
import { ipfsCreds, ipfsUpload } from '../helpers/upload/ipfs';

export async function upload(
  connection: Connection,
  imgFile: string,
  env: string,
  keypair: string,
  storage: string,
  ipfsCredentials: ipfsCreds,
  awsS3Bucket: string,
): Promise<boolean> {
  let uploadSuccessful = true;

  const seen = {};
  const newFiles = [];

  const f = imgFile;
  seen[f.replace(EXTENSION_PNG, '').replace(EXTENSION_JPG, '').split('/').pop()] = true;
  newFiles.push(f);
  const images = newFiles.filter(val => path.extname(val) === EXTENSION_PNG || path.extname(val) === EXTENSION_JPG);
  const SIZE = images.length;

  const walletKeyPair = loadWalletKey(keypair);

  for (let i = 0; i < SIZE; i++) {
    const image = images[i];
    const imageName = path.basename(image);
    const name = imageName.replace(EXTENSION_PNG, '').replace(EXTENSION_JPG, '');

    log.debug(`Processing file: ${i}`);
    if (i % 50 === 0) {
      log.info(`Processing file: ${i}`);
    }

    let link;

    if (!link) {
      try {
        if (storage === 'arweave') {
          link = await arweaveUpload(
            connection,
            walletKeyPair,
            env,
            image,
            name,
          );
        } else if (storage === 'ipfs') {
          link = await ipfsUpload(ipfsCredentials, image);
        } else if (storage === 'aws') {
          link = await awsUpload(awsS3Bucket, image);
        }

        if (link) {
          log.info(`Upload succeed: ${link}`);
        }
      } catch (er) {
        uploadSuccessful = false;
        log.error(`Error uploading file ${name}`, er);
      }
    }
  }

  console.log(`Done. Successful = ${uploadSuccessful}.`);
  return uploadSuccessful;
}

export async function uploadMeta(
  connection: Connection,
  metadata: any,
  env: string,
  walletKeyPair: Keypair,
): Promise<{status: boolean, link: string }> {
  let uploadSuccessful = true;

  const manifestBuffer = Buffer.from(JSON.stringify(metadata));

  let link;
  try {
    link = await arweaveMetaUpload(
      walletKeyPair,
      connection,
      env,
      manifestBuffer,
      metadata,
      0,
    );

    if (link) {
      log.info(`Metadata upload succeed: ${link}`);
    }
  } catch (er) {
    uploadSuccessful = false;
    log.error(`Error uploading file ${metadata.name}`, er);
  }
  console.log(`Done. Successful = ${uploadSuccessful}.`);
  return { status: uploadSuccessful, link };
}
