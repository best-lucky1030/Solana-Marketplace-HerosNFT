import {
  createAssociatedTokenAccountInstruction,
  createMetadataInstruction,
  purchaseHeroInstruction,
  createMasterEditionInstruction,
} from '../helpers/instructions';
import { sendTransactionWithRetryWithKeypair } from '../helpers/transactions';
import {
  getTokenWallet,
  getMetadata,
  getMasterEdition,
  getHeroDataKey,
} from '../helpers/accounts';
import * as anchor from '@project-serum/anchor';
import {
  Data,
  Herodata,
  Creator,
  CreateMetadataArgs,
  PurchaseHeroArgs,
  CreateMasterEditionArgs,
  METADATA_SCHEMA,
} from '../helpers/schema';
import { serialize } from 'borsh';
import { getProgramAccounts, decodeHeroMetadata } from './fetchAll';
import { uploadMeta } from './upload';
import { TOKEN_PROGRAM_ID } from '../helpers/constants';
import { AccountLayout, MintLayout, u64, Token } from '@solana/spl-token';
import {
  Keypair,
  Connection,
  SystemProgram,
  TransactionInstruction,
  PublicKey,
} from '@solana/web3.js';
import BN from 'bn.js';
import log from 'loglevel';
import { sleep } from '../helpers/various';

export const purchaseNFT = async (
  connection: Connection,
  heroProgramAddress: string,
  env: string,
  walletKeypair: Keypair,
  id: number,
  new_name: string,
  new_uri: string,
  new_price: number,
): Promise<{
  metadataAccount: PublicKey;
} | void> => {
  // Validate heroData
  if (
    new_price && isNaN(new_price)
  ) {
    log.error('Invalid new_price', new_price);
    return;
  }

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
  let heroData: Herodata;
  for(let hero of result) {
    const accountPubkey = hero.pubkey;
    if (accountPubkey == herodataAccount.toBase58()) {
      const decoded: Herodata = await decodeHeroMetadata(hero.account.data);
      ownerNftAddress = new PublicKey(decoded.ownerNftAddress);
      heroData = decoded;
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
      new PurchaseHeroArgs({
        id,
        name: new_name ? new_name : null,
        uri: new_uri ? new_uri : null,
        price: !new_price || new_price == NaN ? null : new BN(new_price),
      }),
    ),
  );
  
  // Generate a mint
  const mint = anchor.web3.Keypair.generate();
  signers.push(mint);

  // Allocate memory for the account
  const mintRent = await connection.getMinimumBalanceForRentExemption(
    MintLayout.span,
  );

  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mint.publicKey,
      lamports: mintRent,
      space: MintLayout.span,
      programId: TOKEN_PROGRAM_ID,
    }),
  );

  instructions.push(
    purchaseHeroInstruction(
      herodataAccount,
      wallet.publicKey,
      new PublicKey(accountOwnerPubkey),
      new PublicKey(accountPubkey),
      mint.publicKey,
      txnData,
      programId,
    ),
  );

  let name = Buffer.from(heroData.name);
  name = name.slice(0, name.indexOf(0));
  let uri = Buffer.from(heroData.uri);
  uri = uri.slice(0, uri.indexOf(0));

  let metadata = {
    "name": new_name ? new_name : name.toString(),
    "image": new_uri ? new_uri : uri.toString(),
    "symbol": '',
    "seller_fee_basis_points": 0,
    "description": "",
    "collection": {},
    "attributes": [],
    "properties": {
      "files": [
        {
          "uri": new_uri ? new_uri : uri.toString(),
          "type": "image/png"
        }
      ],
      "category": "image",
      "creators": [
        {
          "address": wallet.publicKey.toBase58(),
          "share": 100,
        },
        {
          "address": programId.toBase58(),
          "share": 0,
        }
      ],
    }
  };

  let warn = false;
  let metadata_uri;
  for (;;) {
    const {
      status,
      link
    } = await uploadMeta(
      connection,
      metadata,
      env,
      walletKeypair,
    );

    if (status) {
      warn = false;
      metadata_uri = link;
      break;
    } else {
      warn = true;
      log.warn('upload was not successful, rerunning');
    }
  }
  log.info(`Uploaded metadata to Arweave`);
  sleep(2000);
  
  // Validate metadata
  if (
    !metadata.name ||
    !metadata.image ||
    isNaN(metadata.seller_fee_basis_points) ||
    !metadata.properties
  ) {
    log.error('Invalid metadata file', metadata);
    return;
  }

  instructions.push(
    Token.createInitMintInstruction(
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      0,
      wallet.publicKey,
      wallet.publicKey,
    ),
  );

  const userTokenAccoutAddress = await getTokenWallet(
    wallet.publicKey,
    mint.publicKey,
  );
  instructions.push(
    createAssociatedTokenAccountInstruction(
      userTokenAccoutAddress,
      wallet.publicKey,
      wallet.publicKey,
      mint.publicKey,
    ),
  );

  // Create metadata
  const metadataAccount = await getMetadata(mint.publicKey);
  const creators = [
      new Creator({
        address: wallet.publicKey.toBase58(),
        share: 100,
        verified: 1,
      }),
      new Creator({
        address: programId.toBase58(),
        share: 0,
        verified: 0,
      }),
  ];
  const data = new Data({
    symbol: metadata.symbol,
    name: metadata.name,
    uri: metadata_uri,
    sellerFeeBasisPoints: metadata.seller_fee_basis_points,
    creators: creators,
  });
  log.info(data);
  
  let nftTxnData = Buffer.from(
    serialize(
      METADATA_SCHEMA,
      new CreateMetadataArgs({ data, isMutable: false }),
    ),
  );

  instructions.push(
    createMetadataInstruction(
      metadataAccount,
      mint.publicKey,
      wallet.publicKey,
      wallet.publicKey,
      wallet.publicKey,
      nftTxnData,
    ),
  );

  instructions.push(
    Token.createMintToInstruction(
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      userTokenAccoutAddress,
      wallet.publicKey,
      [],
      1,
    ),
  );

  // Create master edition
  const editionAccount = await getMasterEdition(mint.publicKey);
  nftTxnData = Buffer.from(
    serialize(
      METADATA_SCHEMA,
      new CreateMasterEditionArgs({ maxSupply: new BN(0) }),
    ),
  );

  instructions.push(
    createMasterEditionInstruction(
      metadataAccount,
      editionAccount,
      mint.publicKey,
      wallet.publicKey,
      wallet.publicKey,
      wallet.publicKey,
      nftTxnData,
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
  log.info('Purchase NFT minted', res.txid);
  return { metadataAccount };
};

export const deserializeAccount = (data: Buffer) => {
  const accountInfo = AccountLayout.decode(data);
  accountInfo.mint = new PublicKey(accountInfo.mint);
  accountInfo.owner = new PublicKey(accountInfo.owner);
  accountInfo.amount = u64.fromBuffer(accountInfo.amount);

  return accountInfo;
};