# Commands

Some handy commands are provided for testing as well as a starting point for building other apps that interface with this program.

Before getting started, create a file named `.env` with the following contents:

```txt
HERO_METADATA_PROGRAM_ID="the solana network URL"
```

Alternatively, you can set the above as environment variables.

For devnet, you can use these:

    Provider URL: https://api.devnet.solana.com
    Program ID:

For mainnet, you can use these:

    Provider URL: https://api.mainnet-beta.solana.com
    Program ID: 

Then should open terminal and change to current dir.

```sh
cd cli
```

### Expected args

- `-k --keypair`: the wallet keypair path.  `Required`
- `-e --env`: solana cluster env name.  `Default`: devnet
- `-l --log-level <string>`: log level (`debug`, `info`) of test script.  `Default`: info

## Show

This command returns the hero accounts created to be sold.

```sh
ts-node cli-hero.ts show_all
```

## Create New Hero

This command create a new hero account.

```sh
ts-node cli-hero.ts create_hero
```

### Some notes

- This account must be run by a wallet that is:
  - the authority defined in the provided admin account in rust program
  - the id of new hero auto increased
  - the initial last price of new hero is 0

### Expected args

- `-n --name <string>`: new hero name  `Required`
- `-u --uri <string>`: new hero image uri  `Required`
- `-p --price <string>`: new hero listed price  `Required`
- `-o --owner <string>`: new hero owner nft mint address  `Required`

## Upate Owned Hero Price

This command update the listed price of owned hero account.

```sh
ts-node cli-hero.ts update_hero_price
```

### Some notes

- This account must be run by a wallet that is:
  - the payer who is the owner of nft token mint which saved in hero data ownerNftAddress
  - the id should be in range of all heros count

### Expected args

- `-i --id <number>`: hero id of current payer owned  `Required`
- `-p --price <string>`: new listed price hero  `Required`

## Purchase Hero

This account executes a hero purchase.  Ordinarily, a purchase would happen whenever since the hero is created. To buy an hero, should pay listed price to the owner of hero: owner of ownerNFTaddress in hero data.

```sh
ts-node cli-hero.ts buy_hero
```

### Expected args

- `-i --id <number>`:  hero Id of purchase  `Optional`
- `-n --name <string>`:  new hero name after purchase for new buyer  `Optional`
- `-u --uri <string>`:  new hero image after purchase for new buyer  `Optional`
- `-p --price <string>`:  new hero listed price after purchase for new buyer  `Optional`

If the buyer is not set the new args, then the saved hero data is used for the new buyer.

### Other needed file

The data file is a JSON file that looks something like this:

```png
cli/meta_image.png
```

This file is used while mint NFT for purchase Hero. But not presented in anywhere.

## Upload Image to Arweave or Ipfs & Aws

This command used to upload hero image to arweave, ipfs or aws.

```sh
ts-node cli-hero.ts upload_image <file>
```

`<file>`: Image file path to upload

### Expected args

- `-s --storage <string>`: Database to use for storage (arweave, ipfs, aws)
    `Default`: 'arweave'

- `--ipfs-infura-project-id <string>`: Infura IPFS project id (required if using IPFS)
    `In case`

- `--ipfs-infura-secret <string>`: Infura IPFS scret key (required if using IPFS)
    `In case`
    
- `--aws-s3-bucket <string>`: (existing) AWS S3 Bucket name (required if using aws)
    `In case`
