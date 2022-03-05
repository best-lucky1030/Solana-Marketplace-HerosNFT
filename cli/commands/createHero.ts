import {
  createHeroMetadataInstruction,
} from '../helpers/instructions';
import { sendTransactionWithRetryWithKeypair } from '../helpers/transactions';
import {
  getHeroDataKey,
} from '../helpers/accounts';
import * as anchor from '@project-serum/anchor';
import {
  Herodata,
  CreateHeroMetadataArgs,
  METADATA_SCHEMA,
} from '../helpers/schema';
import { serialize } from 'borsh';
import { getProgramAccounts } from './fetchAll';
import {
  Keypair,
  Connection,
  TransactionInstruction,
  PublicKey,
} from '@solana/web3.js';
import log from 'loglevel';

export const createNewHero = async (
  connection: Connection,
  heroProgramAddress: string,
  walletKeypair: Keypair,
  heroData: {
    name: string,
    uri: string,
    price: number,
    ownerNftAddress: PublicKey,
  }
): Promise<{
  herodataAccount: PublicKey;
} | void> => {
  // Validate heroData
  if (
    !heroData.name ||
    !heroData.uri ||
    isNaN(heroData.price) ||
    !heroData.ownerNftAddress
  ) {
    log.error('Invalid heroData', heroData);
    return;
  }

  log.info(heroData);
  // Create wallet from keypair
  const wallet = new anchor.Wallet(walletKeypair);
  if (!wallet?.publicKey) return;

  const programId = new PublicKey(heroProgramAddress);
  
  const fetchData = await getProgramAccounts(
    connection,
    heroProgramAddress,
    {},
  );

  let newHeroId = fetchData.length + 1;
  log.info(`New Hero Id: ${newHeroId}`);

  const instructions: TransactionInstruction[] = [];
  const signers: anchor.web3.Keypair[] = [/*mint, */walletKeypair];

  // Create metadata
  const herodataAccount = await getHeroDataKey(newHeroId, programId);
  log.info(`Generated hero account: ${herodataAccount}`);
  const ownerNftPubkey = new PublicKey(heroData.ownerNftAddress);
  const pubkeyArray = new Uint8Array(ownerNftPubkey.toBuffer());
  const data = new Herodata({
    id: newHeroId,
    name: heroData.name,
    uri: heroData.uri,
    lastPrice: 0,
    listedPrice: heroData.price,
    ownerNftAddress: pubkeyArray,
  });

  log.info(data);
  let txnData = Buffer.from(
    serialize(
      METADATA_SCHEMA,
      new CreateHeroMetadataArgs({ data, id: newHeroId }),
    ),
  );

  instructions.push(
    createHeroMetadataInstruction(
      herodataAccount,
      wallet.publicKey,
      txnData,
      programId,
    ),
  );

  const res = await sendTransactionWithRetryWithKeypair(
    connection,
    walletKeypair,
    instructions,
    signers,
  );

  try {
    await connection.confirmTransaction(res.txid, 'max');
  } catch {
    // ignore
  }

  // Force wait for max confirmations
  await connection.getParsedConfirmedTransaction(res.txid, 'confirmed');
  log.info('Hero NFT created', res.txid);
  return { herodataAccount };
};
