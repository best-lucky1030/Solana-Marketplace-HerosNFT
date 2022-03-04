// use solana_client::rpc_request::TokenAccountsFilter;

use {
    clap::{crate_description, crate_name, crate_version, App, Arg, ArgMatches, SubCommand},
    metaplex_token_metadata::{
        instruction::{
            create_metadata_accounts,
            update_hero_price,
            purchase_hero,
        },
        state::{
            HeroData, PREFIX,
            // MAX_SYMBOL_LENGTH, MAX_NAME_LENGTH, MAX_URI_LENGTH,
        },
    },
    solana_clap_utils::{
        input_parsers::pubkey_of,
        input_validators::{is_url, is_valid_pubkey, is_valid_signer},
    },
    solana_client::{
        rpc_client::RpcClient,
        rpc_config::{RpcAccountInfoConfig, RpcProgramAccountsConfig},
        rpc_filter::{Memcmp, MemcmpEncodedBytes, RpcFilterType},
    },

    solana_program::{
        account_info::AccountInfo, borsh::try_from_slice_unchecked, program_pack::Pack,
    },
    solana_sdk::{
        pubkey::Pubkey,
        signature::{read_keypair_file, Keypair, Signer},
        commitment_config::{CommitmentConfig, CommitmentLevel},
        system_instruction::create_account,
        transaction::Transaction,
    },
    
    spl_token::{
        instruction::{initialize_account, initialize_mint, mint_to},
        state::{Account as TokenAccount, Mint},
    },
    std::str::FromStr,
};
use solana_account_decoder::{
    parse_account_data::{parse_account_data, AccountAdditionalData, ParsedAccount},
    UiAccountEncoding,
};

pub const DEFAULT_LAMPORTS_PER_SOL: u64 = 1_000_000_000;

// const TOKEN_PROGRAM_PUBKEY: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
// const TOKEN_METADATA_PROGRAM_PUBKEY: &str = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
// fn puff_unpuffed_metadata(_app_matches: &ArgMatches, payer: Keypair, client: RpcClient) {
//     let metadata_accounts = client
//         .get_program_accounts(&metaplex_token_metadata::id())
//         .unwrap();
//     let mut needing_puffing = vec![];
//     for acct in metadata_accounts {
//         if acct.1.data[0] == Key::MetadataV1 as u8 {
//             match try_from_slice_unchecked(&acct.1.data) {
//                 Ok(val) => {
//                     let account: Metadata = val;
//                     if account.data.name.len() < MAX_NAME_LENGTH
//                         || account.data.uri.len() < MAX_URI_LENGTH
//                         || account.data.symbol.len() < MAX_SYMBOL_LENGTH
//                         || account.edition_nonce.is_none()
//                     {
//                         needing_puffing.push(acct.0);
//                     }
//                 }
//                 Err(_) => {
//                     println!("Skipping {}", acct.0)
//                 }
//             };
//         }
//     }
//     println!("Found {} accounts needing puffing", needing_puffing.len());

//     let mut instructions = vec![];
//     let mut i = 0;
//     while i < needing_puffing.len() {
//         let pubkey = needing_puffing[i];
//         instructions.push(puff_metadata_account(metaplex_token_metadata::id(), pubkey));
//         if instructions.len() >= 20 {
//             let mut transaction = Transaction::new_with_payer(&instructions, Some(&payer.pubkey()));
//             let recent_blockhash = client.get_recent_blockhash().unwrap().0;

//             transaction.sign(&[&payer], recent_blockhash);
//             match client.send_and_confirm_transaction(&transaction) {
//                 Ok(_) => {
//                     println!("Another 20 down. At {} / {}", i, needing_puffing.len());
//                     instructions = vec![];
//                     i += 1;
//                 }
//                 Err(_) => {
//                     println!("Txn failed. Retry.");
//                     std::thread::sleep(std::time::Duration::from_millis(1000));
//                 }
//             }
//         } else {
//             i += 1;
//         }
//     }

//     if instructions.len() > 0 {
//         let mut transaction = Transaction::new_with_payer(&instructions, Some(&payer.pubkey()));
//         let recent_blockhash = client.get_recent_blockhash().unwrap().0;
//         transaction.sign(&[&payer], recent_blockhash);
//         client.send_and_confirm_transaction(&transaction).unwrap();
//     }
// }

// fn mint_coins(app_matches: &ArgMatches, payer: Keypair, client: RpcClient) {
//     let token_key = Pubkey::from_str(TOKEN_PROGRAM_PUBKEY).unwrap();
//     let amount = match app_matches.value_of("amount") {
//         Some(val) => Some(val.parse::<u64>().unwrap()),
//         None => None,
//     }
//     .unwrap();
//     let mint_key = pubkey_of(app_matches, "mint").unwrap();
//     let mut instructions = vec![];

//     let mut signers = vec![&payer];
//     let destination_key: Pubkey;
//     let destination = Keypair::new();
//     if app_matches.is_present("destination") {
//         destination_key = pubkey_of(app_matches, "destination").unwrap();
//     } else {
//         destination_key = destination.pubkey();
//         signers.push(&destination);
//         instructions.push(create_account(
//             &payer.pubkey(),
//             &destination_key,
//             client
//                 .get_minimum_balance_for_rent_exemption(Account::LEN)
//                 .unwrap(),
//             Account::LEN as u64,
//             &token_key,
//         ));
//         instructions.push(
//             initialize_account(&token_key, &destination_key, &mint_key, &payer.pubkey()).unwrap(),
//         );
//     }
//     instructions.push(
//         mint_to(
//             &token_key,
//             &mint_key,
//             &destination_key,
//             &payer.pubkey(),
//             &[&payer.pubkey()],
//             amount,
//         )
//         .unwrap(),
//     );
//     let mut transaction = Transaction::new_with_payer(&instructions, Some(&payer.pubkey()));
//     let recent_blockhash = client.get_recent_blockhash().unwrap().0;

//     transaction.sign(&signers, recent_blockhash);
//     client.send_and_confirm_transaction(&transaction).unwrap();

//     println!("Minted {:?} tokens to {:?}.", amount, destination_key);
// }
// fn show_reservation_list(app_matches: &ArgMatches, _payer: Keypair, client: RpcClient) {
//     let key = pubkey_of(app_matches, "key").unwrap();
//     let mut res_data = client.get_account(&key).unwrap();
//     let mut lamports = 0;
//     let account_info = AccountInfo::new(
//         &key,
//         false,
//         false,
//         &mut lamports,
//         &mut res_data.data,
//         &res_data.owner,
//         false,
//         0,
//     );

//     let res_list = get_reservation_list(&account_info).unwrap();
//     println!("Res list {:?}", res_list.reservations());
//     println!(
//         "current res spots: {:?}",
//         res_list.current_reservation_spots()
//     );
//     println!("total res spots: {:?}", res_list.total_reservation_spots());
//     println!("supply snapshot: {:?}", res_list.supply_snapshot());
// }

// fn show(app_matches: &ArgMatches, _payer: Keypair, client: RpcClient) {
//     let program_key = metaplex_token_metadata::id();

//     let printing_mint_key = pubkey_of(app_matches, "mint").unwrap();
//     let master_metadata_seeds = &[
//         PREFIX.as_bytes(),
//         &program_key.as_ref(),
//         printing_mint_key.as_ref(),
//     ];
//     let (master_metadata_key, _) =
//         Pubkey::find_program_address(master_metadata_seeds, &program_key);

//     let master_metadata_account = client.get_account(&master_metadata_key).unwrap();
//     let master_metadata: Metadata =
//         try_from_slice_unchecked(&master_metadata_account.data).unwrap();

//     let update_authority = master_metadata.update_authority;

//     let master_edition_seeds = &[
//         PREFIX.as_bytes(),
//         &program_key.as_ref(),
//         &master_metadata.mint.as_ref(),
//         EDITION.as_bytes(),
//     ];
//     let (master_edition_key, _) = Pubkey::find_program_address(master_edition_seeds, &program_key);
//     let master_edition_account_res = client.get_account(&master_edition_key);

//     println!("Metadata key: {:?}", master_metadata_key);
//     println!("Metadata: {:#?}", master_metadata);
//     println!("Update authority: {:?}", update_authority);
//     match master_edition_account_res {
//         Ok(master_edition_account) => {
//             if master_edition_account.data[0] == Key::MasterEditionV1 as u8 {
//                 let master_edition: MasterEditionV1 =
//                     try_from_slice_unchecked(&master_edition_account.data).unwrap();
//                 println!("Deprecated Master edition {:#?}", master_edition);
//             } else if master_edition_account.data[0] == Key::MasterEditionV2 as u8 {
//                 let master_edition: MasterEditionV2 =
//                     try_from_slice_unchecked(&master_edition_account.data).unwrap();
//                 println!("Master edition {:#?}", master_edition);
//             } else {
//                 let edition: Edition =
//                     try_from_slice_unchecked(&master_edition_account.data).unwrap();
//                 println!("Limited edition {:#?}", edition);
//             }
//         }
//         Err(_) => {
//             println!("No master edition or edition detected")
//         }
//     }
// }

// fn mint_edition_via_token_call(
//     app_matches: &ArgMatches,
//     payer: Keypair,
//     client: RpcClient,
// ) -> (Edition, Pubkey, Pubkey) {
//     let account_authority = read_keypair_file(
//         app_matches
//             .value_of("account_authority")
//             .unwrap_or_else(|| app_matches.value_of("keypair").unwrap()),
//     )
//     .unwrap();

//     let program_key = metaplex_token_metadata::id();
//     let token_key = Pubkey::from_str(TOKEN_PROGRAM_PUBKEY).unwrap();

//     let mint_key = pubkey_of(app_matches, "mint").unwrap();
//     let existing_token_account = Pubkey::from_str(
//         &client
//             .get_token_accounts_by_owner(
//                 &account_authority.pubkey(),
//                 TokenAccountsFilter::Mint(mint_key),
//             )
//             .unwrap()
//             .iter()
//             .find(|x| {
//                 client
//                     .get_token_account_balance(&Pubkey::from_str(&x.pubkey).unwrap())
//                     .unwrap()
//                     .amount
//                     != "0"
//             })
//             .unwrap()
//             .pubkey,
//     )
//     .unwrap();

//     let new_mint_key = Keypair::new();
//     let added_token_account = Keypair::new();
//     let new_mint_pub = new_mint_key.pubkey();
//     let metadata_seeds = &[
//         PREFIX.as_bytes(),
//         &program_key.as_ref(),
//         &new_mint_pub.as_ref(),
//     ];
//     let (metadata_key, _) = Pubkey::find_program_address(metadata_seeds, &program_key);

//     let edition_seeds = &[
//         PREFIX.as_bytes(),
//         &program_key.as_ref(),
//         &new_mint_pub.as_ref(),
//         EDITION.as_bytes(),
//     ];
//     let (edition_key, _) = Pubkey::find_program_address(edition_seeds, &program_key);

//     let master_metadata_seeds = &[PREFIX.as_bytes(), &program_key.as_ref(), mint_key.as_ref()];
//     let (master_metadata_key, _) =
//         Pubkey::find_program_address(master_metadata_seeds, &program_key);

//     let master_metadata_account = client.get_account(&master_metadata_key).unwrap();
//     let master_metadata: Metadata =
//         try_from_slice_unchecked(&master_metadata_account.data).unwrap();

//     let master_edition_seeds = &[
//         PREFIX.as_bytes(),
//         &program_key.as_ref(),
//         &master_metadata.mint.as_ref(),
//         EDITION.as_bytes(),
//     ];
//     let (master_edition_key, _) = Pubkey::find_program_address(master_edition_seeds, &program_key);
//     let master_edition_account = client.get_account(&master_edition_key).unwrap();
//     let master_edition: MasterEditionV2 =
//         try_from_slice_unchecked(&master_edition_account.data).unwrap();
//     let signers = vec![&account_authority, &new_mint_key, &added_token_account];
//     let mut instructions = vec![
//         create_account(
//             &payer.pubkey(),
//             &new_mint_key.pubkey(),
//             client
//                 .get_minimum_balance_for_rent_exemption(Mint::LEN)
//                 .unwrap(),
//             Mint::LEN as u64,
//             &token_key,
//         ),
//         initialize_mint(
//             &token_key,
//             &new_mint_key.pubkey(),
//             &payer.pubkey(),
//             Some(&payer.pubkey()),
//             0,
//         )
//         .unwrap(),
//         create_account(
//             &payer.pubkey(),
//             &added_token_account.pubkey(),
//             client
//                 .get_minimum_balance_for_rent_exemption(Account::LEN)
//                 .unwrap(),
//             Account::LEN as u64,
//             &token_key,
//         ),
//         initialize_account(
//             &token_key,
//             &added_token_account.pubkey(),
//             &new_mint_key.pubkey(),
//             &payer.pubkey(),
//         )
//         .unwrap(),
//         mint_to(
//             &token_key,
//             &new_mint_key.pubkey(),
//             &added_token_account.pubkey(),
//             &payer.pubkey(),
//             &[&payer.pubkey()],
//             1,
//         )
//         .unwrap(),
//     ];

//     instructions.push(mint_new_edition_from_master_edition_via_token(
//         program_key,
//         metadata_key,
//         edition_key,
//         master_edition_key,
//         new_mint_key.pubkey(),
//         account_authority.pubkey(),
//         payer.pubkey(),
//         account_authority.pubkey(),
//         existing_token_account,
//         account_authority.pubkey(),
//         master_metadata_key,
//         master_metadata.mint,
//         master_edition.supply + 1,
//     ));

//     let mut transaction = Transaction::new_with_payer(&instructions, Some(&payer.pubkey()));
//     let recent_blockhash = client.get_recent_blockhash().unwrap().0;

//     transaction.sign(&signers, recent_blockhash);
//     client.send_and_confirm_transaction(&transaction).unwrap();
//     let account = client.get_account(&edition_key).unwrap();
//     let edition: Edition = try_from_slice_unchecked(&account.data).unwrap();
//     (edition, edition_key, new_mint_key.pubkey())
// }

// fn master_edition_call(
//     app_matches: &ArgMatches,
//     payer: Keypair,
//     client: RpcClient,
// ) -> (MasterEditionV2, Pubkey) {
//     let update_authority = read_keypair_file(
//         app_matches
//             .value_of("update_authority")
//             .unwrap_or_else(|| app_matches.value_of("keypair").unwrap()),
//     )
//     .unwrap();
//     let mint_authority = read_keypair_file(
//         app_matches
//             .value_of("mint_authority")
//             .unwrap_or_else(|| app_matches.value_of("keypair").unwrap()),
//     )
//     .unwrap();

//     let program_key = metaplex_token_metadata::id();
//     let token_key = Pubkey::from_str(TOKEN_PROGRAM_PUBKEY).unwrap();

//     let mint_key = pubkey_of(app_matches, "mint").unwrap();
//     let metadata_seeds = &[PREFIX.as_bytes(), &program_key.as_ref(), mint_key.as_ref()];
//     let (metadata_key, _) = Pubkey::find_program_address(metadata_seeds, &program_key);

//     let metadata_account = client.get_account(&metadata_key).unwrap();
//     let metadata: Metadata = try_from_slice_unchecked(&metadata_account.data).unwrap();

//     let master_edition_seeds = &[
//         PREFIX.as_bytes(),
//         &program_key.as_ref(),
//         &metadata.mint.as_ref(),
//         EDITION.as_bytes(),
//     ];
//     let (master_edition_key, _) = Pubkey::find_program_address(master_edition_seeds, &program_key);

//     let max_supply = match app_matches.value_of("max_supply") {
//         Some(val) => Some(val.parse::<u64>().unwrap()),
//         None => None,
//     };

//     let added_token_account = Keypair::new();

//     let needs_a_token = app_matches.is_present("add_one_token");
//     let mut signers = vec![&update_authority, &mint_authority];
//     let mut instructions = vec![];

//     if needs_a_token {
//         signers.push(&added_token_account);
//         instructions.push(create_account(
//             &payer.pubkey(),
//             &added_token_account.pubkey(),
//             client
//                 .get_minimum_balance_for_rent_exemption(Account::LEN)
//                 .unwrap(),
//             Account::LEN as u64,
//             &token_key,
//         ));
//         instructions.push(
//             initialize_account(
//                 &token_key,
//                 &added_token_account.pubkey(),
//                 &metadata.mint,
//                 &payer.pubkey(),
//             )
//             .unwrap(),
//         );
//         instructions.push(
//             mint_to(
//                 &token_key,
//                 &metadata.mint,
//                 &added_token_account.pubkey(),
//                 &payer.pubkey(),
//                 &[&payer.pubkey()],
//                 1,
//             )
//             .unwrap(),
//         )
//     }

//     instructions.push(create_master_edition(
//         program_key,
//         master_edition_key,
//         mint_key,
//         update_authority.pubkey(),
//         mint_authority.pubkey(),
//         metadata_key,
//         payer.pubkey(),
//         max_supply,
//     ));

//     let mut transaction = Transaction::new_with_payer(&instructions, Some(&payer.pubkey()));
//     let recent_blockhash = client.get_recent_blockhash().unwrap().0;

//     transaction.sign(&signers, recent_blockhash);
//     client.send_and_confirm_transaction(&transaction).unwrap();
//     let account = client.get_account(&master_edition_key).unwrap();
//     let master_edition: MasterEditionV2 = try_from_slice_unchecked(&account.data).unwrap();
//     (master_edition, master_edition_key)
// }

// fn update_metadata_account_call(
//     app_matches: &ArgMatches,
//     payer: Keypair,
//     client: RpcClient,
// ) -> (Metadata, Pubkey) {
//     let update_authority = read_keypair_file(
//         app_matches
//             .value_of("update_authority")
//             .unwrap_or_else(|| app_matches.value_of("keypair").unwrap()),
//     )
//     .unwrap();
//     let program_key = metaplex_token_metadata::id();
//     println!("--> {}", program_key);
    
    // let metadata_program_key = Pubkey::from_str(TOKEN_METADATA_PROGRAM_PUBKEY).unwrap();
//     let mint_key = pubkey_of(app_matches, "mint").unwrap();
//     let metadata_seeds = &[PREFIX.as_bytes(), &metadata_program_key.as_ref(), mint_key.as_ref()];
//     let (metadata_key, _) = Pubkey::find_program_address(metadata_seeds, &metadata_program_key);

//     let uri = match app_matches.value_of("uri") {
//         Some(val) => Some(val.to_owned()),
//         None => None,
//     };

//     let name = match app_matches.value_of("name") {
//         Some(val) => Some(val.to_owned()),
//         None => None,
//     };

//     let new_update_authority = pubkey_of(app_matches, "new_update_authority");

//     let metadata_account = client.get_account(&metadata_key).unwrap();
//     let metadata: Metadata = try_from_slice_unchecked(&metadata_account.data).unwrap();

//     let new_data = Data {
//         name: name.unwrap_or(metadata.data.name),
//         symbol: metadata.data.symbol,
//         uri: uri.unwrap_or(metadata.data.uri),
//         seller_fee_basis_points: 0,
//         creators: metadata.data.creators,
//     };

//     let instructions = [update_metadata_accounts(
//         program_key,
//         metadata_key,
//         update_authority.pubkey(),
//         new_update_authority,
//         Some(new_data),
//         None,
//     )];

//     let mut transaction = Transaction::new_with_payer(&instructions, Some(&payer.pubkey()));
//     let recent_blockhash = client.get_recent_blockhash().unwrap().0;
//     let signers = vec![&update_authority];

//     transaction.sign(&signers, recent_blockhash);
//     client.send_and_confirm_transaction(&transaction).unwrap();
//     let metadata_account = client.get_account(&metadata_key).unwrap();
//     let metadata: Metadata = try_from_slice_unchecked(&metadata_account.data).unwrap();
//     (metadata, metadata_key)
// }

fn create_metadata_account_call(
    app_matches: &ArgMatches,
    payer: Keypair,
    client: RpcClient,
) -> (HeroData, Pubkey) {
    // let update_authority = read_keypair_file(
    //     app_matches
    //         .value_of("update_authority")
    //         .unwrap_or_else(|| app_matches.value_of("keypair").unwrap()),
    // )
    // .unwrap();

    let program_key = metaplex_token_metadata::id();
    println!("--->Program_id: {}\n", program_key);

    let accounts = client.get_program_accounts(&program_key).unwrap();
    println!("--> Saved hero accounts: {}", accounts.len());
    let id = accounts.len() as u8 + 1;
    // let id = app_matches.value_of("id").unwrap().parse::<u8>().unwrap();
    let last_price = 0 as u64;
    let listed_price = (app_matches.value_of("listed_price").unwrap().parse::<f64>().unwrap() * DEFAULT_LAMPORTS_PER_SOL as f64).round() as u64;
    let name = app_matches.value_of("name").unwrap().to_owned();
    // let symbol = app_matches.value_of("symbol").unwrap().to_owned();
    let uri = app_matches.value_of("uri").unwrap().to_owned();
    // let create_new_mint = !app_matches.is_present("mint");
    // let mutable = app_matches.is_present("mutable");
    // let new_mint = Keypair::new();
    // let mint_key = match app_matches.value_of("mint") {
    //     Some(_val) => pubkey_of(app_matches, "mint").unwrap(),
    //     None => new_mint.pubkey(),
    // };
    let owner_key = pubkey_of(app_matches, "owner").unwrap();
    println!("--->\n Id: {},\n Name: {},\n Uri: {},\n Last_price: {},\n Listed_price: {},\n Owner: {}\n",
        id, name, uri, last_price, listed_price, owner_key
    );

    let metadata_seeds = &[PREFIX.as_bytes(), &program_key.as_ref(),&[id]];
    let (metadata_key, _) = Pubkey::find_program_address(metadata_seeds, &program_key);
    println!("---> Generated hero Id: {}", metadata_key);

    let new_metadata_instruction = create_metadata_accounts(
        program_key,
        metadata_key,
        payer.pubkey(),
        id,
        name,
        uri,
        last_price,
        listed_price,
        owner_key,
    );

    let mut instructions = vec![];

    // if create_new_mint {
    //     instructions.append(&mut new_mint_instructions)
    // }

    instructions.push(new_metadata_instruction);

    let mut transaction = Transaction::new_with_payer(&instructions, Some(&payer.pubkey()));
    let recent_blockhash = client.get_recent_blockhash().unwrap().0;
    let signers = vec![&payer];
    // if create_new_mint {
    //     signers.push(&new_mint);
    // }
    // if update_authority.pubkey() != payer.pubkey() {
    //     signers.push(&update_authority)
    // }
    transaction.sign(&signers, recent_blockhash);
    client.send_and_confirm_transaction(&transaction).unwrap();
    let account = client.get_account(&metadata_key).unwrap();
    let metadata: HeroData = try_from_slice_unchecked(&account.data).unwrap();
    println!("---> Retrived Hero Data: {}", metadata.name);
    (metadata, metadata_key)
}

fn update_metadata_account_call(
    app_matches: &ArgMatches,
    payer: Keypair,
    client: RpcClient,
) -> (HeroData, Pubkey) {
    let program_key = metaplex_token_metadata::id();
    println!("--->Program_id: {}\n", program_key);

    let id = app_matches.value_of("id").unwrap().parse::<u8>().unwrap();
    let listed_price = (app_matches.value_of("listed_price").unwrap().parse::<f64>().unwrap() * DEFAULT_LAMPORTS_PER_SOL as f64).round() as u64;

    println!("--->\n Id: {},\n Price: {}",id, listed_price);
    
    let metadata_seeds = &[PREFIX.as_bytes(), &program_key.as_ref(),&[id]];
    let (metadata_key, _) = Pubkey::find_program_address(metadata_seeds, &program_key);
    println!("---> Get hero account from id: {}", metadata_key);
    
    let account = client.get_account(&metadata_key).unwrap();
    let metadata: HeroData = try_from_slice_unchecked(&account.data).unwrap();
    println!("---> Retrived Hero Data: name-{}, price-{}", metadata.name, metadata.listed_price);

    let filter1 = RpcFilterType::Memcmp(Memcmp {
        offset: 0,
        bytes: MemcmpEncodedBytes::Binary(metadata.owner_nft_address.to_string()),
        encoding: None,
    });
    let filter2 = RpcFilterType::DataSize(165);
    let account_config = RpcAccountInfoConfig {
        encoding: Some(UiAccountEncoding::Base64),
        data_slice: None,
        commitment: Some(CommitmentConfig {
            commitment: CommitmentLevel::Confirmed,
        }),
    };

    let config = RpcProgramAccountsConfig {
        filters: Some(vec![filter1, filter2]),
        account_config,
        with_context: None,
    };

    let mut nft_owner_key: String = String::new();
    let mut nft_owner_account: Pubkey = Pubkey::new_unique();
    let holders = client.get_program_accounts_with_config(&spl_token::id(), config).unwrap();
    println!("---> Captured holder count: {}", holders.len());
    for (holder_address, holder_account) in holders {
        let data = parse_account_data(
            &metadata.owner_nft_address,
            &spl_token::id(),
            &holder_account.data,
            Some(AccountAdditionalData {
                spl_token_decimals: Some(0),
            }),
        ).unwrap();
        let amount = parse_token_amount(&data).unwrap();

        if amount == 1 {
            let owner_wallet = parse_owner(&data).unwrap();
            nft_owner_key = owner_wallet;
            nft_owner_account = holder_address;
        }
    }
    let owner = Pubkey::from_str(&*nft_owner_key).unwrap();
    println!("--> holder {} - {}", owner, nft_owner_account);

    let mut instructions = vec![];

    let new_metadata_instruction = update_hero_price(
        program_key,
        metadata_key,
        id,
        listed_price,
        payer.pubkey(),
        nft_owner_account,
    );

    instructions.push(new_metadata_instruction);

    let mut transaction = Transaction::new_with_payer(&instructions, Some(&payer.pubkey()));
    let recent_blockhash = client.get_recent_blockhash().unwrap().0;
    let signers = vec![&payer];
    transaction.sign(&signers, recent_blockhash);
    client.send_and_confirm_transaction(&transaction).unwrap();

    let account = client.get_account(&metadata_key).unwrap();
    let metadata: HeroData = try_from_slice_unchecked(&account.data).unwrap();
    println!("---> Updated Hero Data: name-{} new_price-{}", metadata.name, metadata.listed_price);
    (metadata, metadata_key)
}

fn get_all_heros(
    client: &RpcClient,
) {
    let program_key = metaplex_token_metadata::id();
    let accounts = client.get_program_accounts(&program_key).unwrap();
    println!("--> Saved program accounts: {}", accounts.len());

    for (pubkey, account) in accounts {
        println!("hero_account: {:?}", pubkey);
        let metadata: HeroData = try_from_slice_unchecked(&account.data).unwrap();
        println!("data: {:?}", metadata);
    }
}

fn parse_token_amount(data: &ParsedAccount) -> Option<u64> {
    let amount = data
        .parsed
        .get("info")
        .ok_or("Invalid data account!").unwrap()
        .get("tokenAmount")
        .ok_or("Invalid token amount!").unwrap()
        .get("amount")
        .ok_or("Invalid token amount!").unwrap()
        .as_str()
        .ok_or("Invalid token amount!").unwrap()
        .parse().unwrap();
    Some(amount)
}

fn parse_owner(data: &ParsedAccount) -> Option<String> {
    let owner = data
        .parsed
        .get("info")
        .ok_or("Invalid owner account!").unwrap()
        .get("owner")
        .ok_or("Invalid owner account!").unwrap()
        .as_str()
        .ok_or("Invalid owner amount!").unwrap()
        .to_string();
    Some(owner)
}

fn purchase_hero_call(
    app_matches: &ArgMatches,
    payer: Keypair,
    client: RpcClient,
) -> (HeroData, Pubkey) {
    let program_key = metaplex_token_metadata::id();
    println!("--->Program_id: {}\n", program_key);

    let id = app_matches.value_of("id").unwrap().parse::<u8>().unwrap();
    let listed_price = match app_matches.value_of("listed_price") {
        Some(_val) => Some((app_matches.value_of("listed_price").unwrap().parse::<f64>().unwrap() * DEFAULT_LAMPORTS_PER_SOL as f64).round() as u64),
        None => None,
    };
    let uri = match app_matches.value_of("uri") {
        Some(val) => Some(val.to_owned()),
        None => None,
    };

    let name = match app_matches.value_of("name") {
        Some(val) => Some(val.to_owned()),
        None => None,
    };
    
    println!("--->\n Id: {},", id);
    if listed_price != None {
        println!("   Price: {}", listed_price.unwrap());
    };
    // if name != None {
    //     println!("   Name: {}", name);
    // }
    // if uri != None {
    //     println!("   Uri: {}", uri);
    // }
    
    let metadata_seeds = &[PREFIX.as_bytes(), &program_key.as_ref(),&[id]];
    let (metadata_key, _) = Pubkey::find_program_address(metadata_seeds, &program_key);
    println!("---> Get hero account from id: {}", metadata_key);
    
    let account = client.get_account(&metadata_key).unwrap();
    let metadata: HeroData = try_from_slice_unchecked(&account.data).unwrap();
    println!("---> Retrived Hero Data: name-{}, price-{}, owner_nft_account-{}", metadata.name, metadata.listed_price, metadata.owner_nft_address);
    
    let filter1 = RpcFilterType::Memcmp(Memcmp {
        offset: 0,
        bytes: MemcmpEncodedBytes::Binary(metadata.owner_nft_address.to_string()),
        encoding: None,
    });
    let filter2 = RpcFilterType::DataSize(165);
    let account_config = RpcAccountInfoConfig {
        encoding: Some(UiAccountEncoding::Base64),
        data_slice: None,
        commitment: Some(CommitmentConfig {
            commitment: CommitmentLevel::Confirmed,
        }),
    };

    let config = RpcProgramAccountsConfig {
        filters: Some(vec![filter1, filter2]),
        account_config,
        with_context: None,
    };

    let mut nft_owner_key: String = String::new();
    let mut nft_owner_account: Pubkey = Pubkey::new_unique();
    let holders = client.get_program_accounts_with_config(&spl_token::id(), config).unwrap();
    for (holder_address, holder_account) in holders {
        let data = parse_account_data(
            &metadata.owner_nft_address,
            &spl_token::id(),
            &holder_account.data,
            Some(AccountAdditionalData {
                spl_token_decimals: Some(0),
            }),
        ).unwrap();
        let amount = parse_token_amount(&data).unwrap();

        if amount == 1 {
            let owner_wallet = parse_owner(&data).unwrap();
            nft_owner_key = owner_wallet;
            nft_owner_account = holder_address;
        }
    }
    let owner = Pubkey::from_str(&*nft_owner_key).unwrap();
    println!("--> holder {} - {}", owner, nft_owner_account);

    let mut instructions = vec![];

    let new_metadata_instruction = purchase_hero(
        program_key,
        metadata_key,
        id,
        name,
        uri,
        listed_price,
        payer.pubkey(),
        owner,
        nft_owner_account,
        // should be new mint key
        metadata.owner_nft_address,
    );

    instructions.push(new_metadata_instruction);

    let mut transaction = Transaction::new_with_payer(&instructions, Some(&payer.pubkey()));
    let recent_blockhash = client.get_recent_blockhash().unwrap().0;
    let signers = vec![&payer];
    transaction.sign(&signers, recent_blockhash);
    client.send_and_confirm_transaction(&transaction).unwrap();

    let account = client.get_account(&metadata_key).unwrap();
    let metadata: HeroData = try_from_slice_unchecked(&account.data).unwrap();
    println!("---> Updated Hero Data: name-{} new_owner-{}", metadata.name, metadata.owner_nft_address);
    (metadata, metadata_key)
}

fn main() {
    let app_matches = App::new(crate_name!())
        .about(crate_description!())
        .version(crate_version!())
        .arg(
            Arg::with_name("keypair")
                .long("keypair")
                .value_name("KEYPAIR")
                .validator(is_valid_signer)
                .takes_value(true)
                .global(true)
                .help("Filepath or URL to a keypair"),
        )
        .arg(
            Arg::with_name("json_rpc_url")
                .long("url")
                .value_name("URL")
                .takes_value(true)
                .global(true)
                .validator(is_url)
                .help("JSON RPC URL for the cluster [default: devnet]"),
        )
        .arg(
            Arg::with_name("update_authority")
                .long("update_authority")
                .value_name("UPDATE_AUTHORITY")
                .takes_value(true)
                .global(true)
                .help("Update authority filepath or url to keypair besides yourself, defaults to normal keypair"),
        ).subcommand(
            SubCommand::with_name("create_metadata_accounts")
                .about("Create Metadata Accounts")
                .arg(
                    Arg::with_name("name")
                        .long("name")
                        .required(true)
                        .value_name("NAME")
                        .takes_value(true)
                        .help("Name for the Hero"),
                ).arg(
                    Arg::with_name("listed_price")
                        .long("price")
                        .value_name("PRICE")
                        .required(true)
                        .takes_value(true)
                        .help("Published price for new sales (0-10000)"),
                )
                .arg(
                    Arg::with_name("uri")
                        .long("uri")
                        .value_name("URI")
                        .takes_value(true)
                        .required(true)
                        .help("URI for the Hero"),
                )
                .arg(
                    Arg::with_name("owner")
                        .long("owner")
                        .value_name("OWNER")
                        .takes_value(true)
                        .required(true)
                        .help("Pubkey for an owner NFT"),
                )
        ).subcommand(
            SubCommand::with_name("update_metadata_accounts")
                .about("Update Metadata Accounts")
                .arg(
                    Arg::with_name("id")
                        .long("id")
                        .value_name("ID")
                        .required(true)
                        .takes_value(true)
                        .help("Hero Id for update"),
                )
                .arg(
                    Arg::with_name("listed_price")
                        .long("price")
                        .value_name("PRICE")
                        .takes_value(true)
                        .required(true)
                        .help("Published price for new sales (0-10000)"),
                )
        ).subcommand(
            SubCommand::with_name("show")
                .about("Show")
        ).subcommand(
            SubCommand::with_name("buy_hero")
                .about("Buy hero and mint NFT to your account")
                .arg(
                    Arg::with_name("id")
                        .long("id")
                        .value_name("ID")
                        .required(true)
                        .takes_value(true)
                        .help("Hero Id for update"),
                )
                .arg(
                    Arg::with_name("name")
                        .long("new_name")
                        .value_name("NAME")
                        .takes_value(true)
                        .help("Name for the Hero"),
                ).arg(
                    Arg::with_name("listed_price")
                        .long("new_price")
                        .value_name("PRICE")
                        .takes_value(true)
                        .help("Published price for new sales (0-10000)"),
                )
                .arg(
                    Arg::with_name("uri")
                        .long("new_uri")
                        .value_name("URI")
                        .takes_value(true)
                        .help("URI for the Hero"),
                )
        //     SubCommand::with_name("puff_unpuffed_metadata")
                    // .about("Take metadata that still have variable length name, symbol, and uri fields and stretch them out with null symbols so they can be searched more easily by RPC.")
        ).get_matches();

    let client = RpcClient::new(
        app_matches
            .value_of("json_rpc_url")
            .unwrap_or(&"https://api.devnet.solana.com".to_owned())
            .to_owned(),
    );

    let payer = read_keypair_file(app_matches.value_of("keypair").unwrap()).unwrap();

    let (sub_command, sub_matches) = app_matches.subcommand();
    match (sub_command, sub_matches) {
        ("create_metadata_accounts", Some(arg_matches)) => {
            let (metadata, metadata_key) = create_metadata_account_call(arg_matches, payer, client);
            println!(
                "Create metadata account with owner {:?} and key {:?} and name of {:?} and id of {}",
                metadata.owner_nft_address, metadata_key, metadata.name, metadata.id
            );
        }
        ("update_metadata_accounts", Some(arg_matches)) => {
            let (metadata, metadata_key) = update_metadata_account_call(arg_matches, payer, client);
            println!(
                "Update metadata account with owner {:?} and key {:?} and name of {:?} and id of {}",
                metadata.owner_nft_address, metadata_key, metadata.name, metadata.id
            );
        }
        ("show", Some(arg_matches)) => {
            get_all_heros(&client);
        }
        ("buy_hero", Some(arg_matches)) => {
            let (metadata, metadata_key) = purchase_hero_call(arg_matches, payer, client);
            println!(
                "Minted Token account with owner {:?} and key {:?} and name of {:?} and id of {}",
                metadata.owner_nft_address, metadata_key, metadata.name, metadata.id
            );
        }
        _ => unreachable!(),
    }
}
