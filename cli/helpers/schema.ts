import { BinaryReader, BinaryWriter } from 'borsh';
import base58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
type StringPublicKey = string;

import BN from 'bn.js';

export class Creator {
  address: StringPublicKey;
  verified: number;
  share: number;

  constructor(args: {
    address: StringPublicKey;
    verified: number;
    share: number;
  }) {
    this.address = args.address;
    this.verified = args.verified;
    this.share = args.share;
  }
}

export class Data {
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  creators: Creator[] | null;
  constructor(args: {
    name: string;
    symbol: string;
    uri: string;
    sellerFeeBasisPoints: number;
    creators: Creator[] | null;
  }) {
    this.name = args.name;
    this.symbol = args.symbol;
    this.uri = args.uri;
    this.sellerFeeBasisPoints = args.sellerFeeBasisPoints;
    this.creators = args.creators;
  }
}

export class CreateMetadataArgs {
  instruction: number = 0;
  data: Data;
  isMutable: boolean;

  constructor(args: { data: Data; isMutable: boolean }) {
    this.data = args.data;
    this.isMutable = args.isMutable;
  }
}

export class CreateMasterEditionArgs {
  instruction: number = 10;
  maxSupply: BN | null;
  constructor(args: { maxSupply: BN | null }) {
    this.maxSupply = args.maxSupply;
  }
}

export class Herodata {
  id: number;
  name: string;
  uri: string;
  lastPrice: number;
  listedPrice: number;
  ownerNftAddress: Uint8Array;
  constructor(args: {
    id: number;
    name: string;
    uri: string;
    lastPrice: number;
    listedPrice: number;
    ownerNftAddress: Uint8Array;
  }) {
      this.id = args.id;
      this.name = args.name;
      this.uri = args.uri;
      this.lastPrice = args.lastPrice;
      this.listedPrice = args.listedPrice;
      this.ownerNftAddress = args.ownerNftAddress;
  }
}

export class CreateHeroMetadataArgs {
  ins_no: number;
  data: Herodata;
  id: number;
  constructor(args: { data: Herodata, id: number }) {
    this.ins_no = 0;
    this.data = args.data;
    this.id = args.id;
  }
}

export class UpdateHeroMetadataArgs {
  id: number;
  price: BN;
  ins_no: number;
  constructor(args: { id: number, price: BN }) {
    this.ins_no = 1;
    this.id = args.id;
    this.price = args.price;
  }
}

export class PurchaseHeroArgs {
  id: number;
  new_price: BN | null;
  new_name: string | null;
  new_uri: string | null;
  ins_no: number;
  constructor(args: { id: number, price: BN | null, name: string | null, uri: string | null }) {
    this.ins_no = 2;
    this.id = args.id;
    this.new_name = args.name;
    this.new_uri = args.uri;
    this.new_price = args.price;
  }
}

export const METADATA_SCHEMA = new Map<any, any>([
  [
    CreateHeroMetadataArgs,
    {
      kind: 'struct',
      fields: [
        ['ins_no', 'u8'],
        ['data', Herodata],
        ['id', 'u8'],
      ],
    },
  ],
  [
    UpdateHeroMetadataArgs,
    {
      kind: 'struct',
      fields: [
        ['ins_no', 'u8'],
        ['id', 'u8'],
        ['price', 'u64'],
      ],
    },
  ],
  [
    PurchaseHeroArgs,
    {
      kind: 'struct',
      fields: [
        ['ins_no', 'u8'],
        ['id', 'u8'],
        ['new_name', { kind: 'option', type: 'string' }],
        ['new_uri', { kind: 'option', type: 'string' }],
        ['new_price', { kind: 'option', type: 'u64' }],
      ],
    },
  ],
  [
    Herodata,
    {
      kind: 'struct',
      fields: [
        ['id', 'u8'],
        ['name', 'string'],
        ['uri', 'string'],
        ['lastPrice', 'u64'],
        ['listedPrice', 'u64'],
        ['ownerNftAddress', [32]],
      ],
    },
  ],
  [
    CreateMetadataArgs,
    {
      kind: 'struct',
      fields: [
        ['instruction', 'u8'],
        ['data', Data],
        ['isMutable', 'u8'], // bool
      ],
    },
  ],
  [
    CreateMasterEditionArgs,
    {
      kind: 'struct',
      fields: [
        ['instruction', 'u8'],
        ['maxSupply', { kind: 'option', type: 'u64' }],
      ],
    },
  ],
  [
    Data,
    {
      kind: 'struct',
      fields: [
        ['name', 'string'],
        ['symbol', 'string'],
        ['uri', 'string'],
        ['sellerFeeBasisPoints', 'u16'],
        ['creators', { kind: 'option', type: [Creator] }],
      ],
    },
  ],
  [
    Creator,
    {
      kind: 'struct',
      fields: [
        ['address', 'pubkeyAsString'],
        ['verified', 'u8'],
        ['share', 'u8'],
      ],
    },
  ],
]);

export const extendBorsh = () => {
  (BinaryReader.prototype as any).readPubkey = function () {
    const reader = this as unknown as BinaryReader;
    const array = reader.readFixedArray(32);
    return new PublicKey(array);
  };

  (BinaryWriter.prototype as any).writePubkey = function (value: PublicKey) {
    const writer = this as unknown as BinaryWriter;
    writer.writeFixedArray(value.toBuffer());
  };

  (BinaryReader.prototype as any).readPubkeyAsString = function () {
    const reader = this as unknown as BinaryReader;
    const array = reader.readFixedArray(32);
    return base58.encode(array) as StringPublicKey;
  };

  (BinaryWriter.prototype as any).writePubkeyAsString = function (
    value: StringPublicKey,
  ) {
    const writer = this as unknown as BinaryWriter;
    writer.writeFixedArray(base58.decode(value));
  };
};

extendBorsh();
