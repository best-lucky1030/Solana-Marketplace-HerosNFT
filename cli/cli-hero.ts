#!/usr/bin/env ts-node
import * as dotenv from "dotenv";
import * as fs from 'fs';
import { program } from 'commander';
import log from 'loglevel';
import { web3 } from '@project-serum/anchor';

import { createNewHero } from './commands/createHero';
import { updateHero } from './commands/updateHero';
import { purchaseNFT } from './commands/purchaseHero';
import { upload } from './commands/upload';
import { getAllHeros } from './commands/fetchAll';

import { loadWalletKey } from './helpers/accounts';
import {
  parsePrice,
} from './helpers/various';
import {
  EXTENSION_JPG,
  EXTENSION_PNG,
} from './helpers/constants';

dotenv.config({ path: __dirname+'/.env' });

program.version('0.0.1');
log.setLevel('info');

programCommand('create_hero')
  .option('-n, --name <string>', 'hero name')
  .option('-u, --uri <string>', 'hero image')
  .option('-p, --price <string>', 'hero price')
  .option('-o, --owner <string>', 'owner nft mint address')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      keypair,
      env,
      name,
      uri,
      price,
      owner,
    } = cmd.opts();

    let parsedPrice = parsePrice(price);
    if (price && isNaN(parsedPrice)) {
      throw new Error(`Price is not valid. Please input as valid float type.`);
    }

    const solConnection = new web3.Connection(web3.clusterApiUrl(env));
    const programId = process.env.HERO_METADATA_PROGRAM_ID;
    log.info(`Hero program Id: ${programId.toString()}`);
    if (!programId) {
      throw new Error(`Hero Program Id is not provided in .env file`);
    }
    const walletKeyPair = loadWalletKey(keypair);
    log.info(`create_hero: n-${name}, u-${uri}, p-${parsedPrice}, o-${owner}`);
    await createNewHero(solConnection, programId, walletKeyPair, {name, uri, price: parsedPrice, ownerNftAddress: owner});
  });

programCommand('show_all')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      keypair,
      env,
    } = cmd.opts();

    const solConnection = new web3.Connection(web3.clusterApiUrl(env));
    const programId = process.env.HERO_METADATA_PROGRAM_ID;
    if (!programId) {
      throw new Error(`Hero Program Id is not provided in .env file`);
    }
    log.info(`show_all: e-${env} env-${programId}`);
    const heroList = await getAllHeros(solConnection, programId);
    log.info(heroList);
  });

programCommand('update_hero_price')
  .option('-i, --id <number>', 'hero Id')
  .option('-p, --price <string>', 'new hero price')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      keypair,
      env,
      id,
      price,
    } = cmd.opts();

    let parsedPrice = parsePrice(price);
    if (price && isNaN(parsedPrice)) {
      throw new Error(`Price is not valid. Please input as valid float type.`);
    }

    const solConnection = new web3.Connection(web3.clusterApiUrl(env));
    const programId = process.env.HERO_METADATA_PROGRAM_ID;
    if (!programId) {
      throw new Error(`Hero Program Id is not provided in .env file`);
    }
    const walletKeyPair = loadWalletKey(keypair);
    log.info(`update_hero_price: i-${id}, p-${parsedPrice}`);
    await updateHero(solConnection, programId, walletKeyPair, id, parsedPrice);
  });

programCommand('buy_hero')
  .option('-i, --id <number>', 'hero Id')
  .option('-n, --name <string>', 'new hero name')
  .option('-u, --uri <string>', 'new hero image')
  .option('-p, --price <string>', 'new hero price as Sol')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      keypair,
      env,
      id,
      name,
      uri,
      price,
    } = cmd.opts();

    let parsedPrice = parsePrice(price);
    if (price && isNaN(parsedPrice)) {
      throw new Error(`Price is not valid. Please input as valid float type.`);
    }

    const solConnection = new web3.Connection(web3.clusterApiUrl(env));
    const programId = process.env.HERO_METADATA_PROGRAM_ID;
    if (!programId) {
      throw new Error(`Hero Program Id is not provided in .env file`);
    }
    const walletKeyPair = loadWalletKey(keypair);
    let wallet = walletKeyPair.publicKey;
    log.info(`buy_hero: i-${id}, n-${name}, u-${uri}, p-${parsedPrice}`);
    await purchaseNFT(solConnection, programId, env, walletKeyPair, id, name, uri, parsedPrice);
  });

programCommand('upload_image')
  .argument(
    '<file>',
    'Image file path to upload',
  )
  .option(
    '-s, --storage <string>',
    'Database to use for storage (arweave, ipfs, aws)',
    'arweave',
  )
  .option(
    '--ipfs-infura-project-id <string>',
    'Infura IPFS project id (required if using IPFS)',
  )
  .option(
    '--ipfs-infura-secret <string>',
    'Infura IPFS scret key (required if using IPFS)',
  )
  .option(
    '--aws-s3-bucket <string>',
    '(existing) AWS S3 Bucket name (required if using aws)',
  )
  .action(async (imgFile: string, options, cmd) => {
    if(!fs.existsSync(imgFile)) {
      throw new Error(`Image file not exist. Please check the image path.`);
    }

    const {
      keypair,
      env,
      storage,
      ipfsInfuraProjectId,
      ipfsInfuraSecret,
      awsS3Bucket,
    } = cmd.opts();

    if (storage === 'ipfs' && (!ipfsInfuraProjectId || !ipfsInfuraSecret)) {
      throw new Error(
        'IPFS selected as storage option but Infura project id or secret key were not provided.',
      );
    }
    if (storage === 'aws' && !awsS3Bucket) {
      throw new Error(
        'aws selected as storage option but existing bucket name (--aws-s3-bucket) not provided.',
      );
    }
    if (!(storage === 'arweave' || storage === 'ipfs' || storage === 'aws')) {
      throw new Error(
        "Storage option must either be 'arweave', 'ipfs', or 'aws'.",
      );
    }
    const ipfsCredentials = {
      projectId: ipfsInfuraProjectId,
      secretKey: ipfsInfuraSecret,
    };

    const isPngFile = imgFile.endsWith(EXTENSION_PNG);
    const isJpgFile = imgFile.endsWith(EXTENSION_JPG);

    if (!isPngFile && !isJpgFile) {
      throw new Error(
        `Image extension should be png or jpg.`,
      );
    }
    const solConnection = new web3.Connection(web3.clusterApiUrl(env));

    log.info(`Beginning the upload for ${isJpgFile ? `jpg` : `png`} image file`);

    const startMs = Date.now();
    log.info('started at: ' + startMs.toString());
    let warn = false;
    for (;;) {
      const successful = await upload(
        solConnection,
        imgFile,
        env,
        keypair,
        storage,
        ipfsCredentials,
        awsS3Bucket,
      );

      if (successful) {
        warn = false;
        break;
      } else {
        warn = true;
        log.warn('upload was not successful, rerunning');
      }
    }
    const endMs = Date.now();
    const timeTaken = new Date(endMs - startMs).toISOString().substr(11, 8);
    log.info(
      `ended at: ${new Date(endMs).toISOString()}. time taken: ${timeTaken}`,
    );
    if (warn) {
      log.info('not all images have been uploaded, rerun this step.');
    }
  });

function programCommand(name: string) {
  return program
    .command(name)
    .option(
      '-e, --env <string>',
      'Solana cluster env name',
      'devnet', //mainnet-beta, testnet, devnet
    )
    .option(
      '-k, --keypair <path>',
      `Solana wallet location`,
      '--keypair not provided',
    )
    .option('-l, --log-level <string>', 'log level', setLogLevel);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function setLogLevel(value, prev) {
  if (value === undefined || value === null) {
    return;
  }
  log.info('setting the log value to: ' + value);
  log.setLevel(value);
}

program.parse(process.argv);
