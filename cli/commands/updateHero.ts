import {
  updateHeroMetadataInstruction,
} from '../helpers/instructions';
import { sendTransactionWithRetryWithKeypair } from '../helpers/transactions';
import {
  getHeroDataKey,
} from '../helpers/accounts';
import * as anchor from '@project-serum/anchor';
import {
  Herodata,
  UpdateHeroMetadataArgs,
  METADATA_SCHEMA,
} from '../helpers/schema';
import { serialize } from 'borsh';
import { TOKEN_PROGRAM_ID } from '../helpers/constants';
import { getProgramAccounts, decodeHeroMetadata } from './fetchAll';
import { AccountLayout, u64 } from '@solana/spl-token';
import {
  Keypair,
  Connection,
  TransactionInstruction,
  PublicKey,
} from '@solana/web3.js';
import BN from 'bn.js';
import log from 'loglevel';

export const updateHero = async (
  connection: Connection,
  heroProgramAddress: string,
  walletKeypair: Keypair,
  id: number,
  price: number,
): Promise<void> => {
  // Validate heroData
  if (
    isNaN(price)
  ) {
    log.error('Invalid price', price);
    return;
  }

  log.info(price);
  // Create wallet from keypair
  const wallet = new anchor.Wallet(walletKeypair);
  if (!wallet?.publicKey) return;

  const programId = new PublicKey(heroProgramAddress);
  
  const instructions: TransactionInstruction[] = [];
  const signers: anchor.web3.Keypair[] = [walletKeypair];

  // Update metadata
  let herodataAccount = await getHeroDataKey(id, programId);
  log.info(`Generated hero account: ${herodataAccount}`);
  
  const result = await getProgramAccounts(
    connection,
    heroProgramAddress,
    {},
  );
  const count = result.length;
  log.info(`Fetched hero counts: ${count}`);
  if (id > count) {
    log.error('Invalid id ', count);
    return;
  }

  let ownerNftAddress: PublicKey;
  for(let hero of result) {
    const accountPubkey = hero.pubkey;
    if (accountPubkey == herodataAccount.toBase58()) {
      const decoded: Herodata = await decodeHeroMetadata(hero.account.data);
      ownerNftAddress = new PublicKey(decoded.ownerNftAddress);
      break;
    }
  };
  log.info(`Retrived owner nft address: ${ownerNftAddress}`);

  const fetchData = await getProgramAccounts(
    connection,
    TOKEN_PROGRAM_ID.toBase58(),
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: ownerNftAddress.toBase58(),
          },
        },
        {
          dataSize: 165
        },
      ],
    },
  );
  let accountPubkey: string;
  let accountOwnerPubkey: string;
  for(let token of fetchData) {
    accountPubkey = token.pubkey;
    let accountData = deserializeAccount(token.account.data);
    if (accountData.amount == 1) {
      accountOwnerPubkey = accountData.owner;
      break;
    }
  };
  log.info(`Token account address: ${accountPubkey}`);
  log.info(`Token account owner: ${accountOwnerPubkey}`);

  let txnData = Buffer.from(
    serialize(
      METADATA_SCHEMA,
      new UpdateHeroMetadataArgs({ id, price: new BN(price) }),
    ),
  );
  
  instructions.push(
    updateHeroMetadataInstruction(
      herodataAccount,
      wallet.publicKey,
      new PublicKey(accountPubkey),
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
  return ;
};

export const deserializeAccount = (data: Buffer) => {
  const accountInfo = AccountLayout.decode(data);
  accountInfo.mint = new PublicKey(accountInfo.mint);
  accountInfo.owner = new PublicKey(accountInfo.owner);
  accountInfo.amount = u64.fromBuffer(accountInfo.amount);

  return accountInfo;
};