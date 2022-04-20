import { useEffect, useState } from "react";
import styled from "styled-components";
import Countdown from "react-countdown";
import axios from 'axios';
import { Button, CircularProgress, Snackbar } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";

import * as anchor from "@project-serum/anchor";

import { LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletDialogButton } from "@solana/wallet-adapter-material-ui";

import {
  CandyMachine,
  awaitTransactionSignatureConfirmation,
  getCandyMachineState,
  mintOneToken,
  shortenAddress,
  getTokenWallet,
  createAssociatedTokenAccountInstruction,
} from "./hero_script";

import Skeleton from './logo.svg';
import { randomBytes } from "crypto";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getParsedNftAccountsByOwner } from '@nfteyez/sol-rayz';

const OWNER_WALLET_PUBKEY = 'E5GSUDTQAvJouZkxHFGMA3THVzXWvrs4hRZEag2au3k6';//'51QHr8aS4En232fPCWUYLxWYw4crwxeap56n4jF1283Y';

const ConnectButton = styled(WalletDialogButton)``;

const CounterText = styled.span``; // add your styles here

const MintContainer = styled.div``; // add your styles here

const MintButton = styled(Button)``; // add your styles here

export interface HomeProps {
  candyMachineId: anchor.web3.PublicKey;
  config: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  startDate: number;
  treasury: anchor.web3.PublicKey;
  txTimeout: number;
}

interface NFTItem {
  pubkey: string,
  uri: string | undefined,
}

const indexes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const items = [
  {pubkey: '1', uri: undefined},
  {pubkey: '2', uri: undefined},
  {pubkey: '3', uri: undefined},
  {pubkey: '4', uri: undefined},
  {pubkey: '5', uri: undefined},
  {pubkey: '6', uri: undefined},
  {pubkey: '7', uri: undefined},
  {pubkey: '8', uri: undefined},
  {pubkey: '9', uri: undefined},
  {pubkey: '10', uri: undefined},
  {pubkey: '11', uri: undefined},
  {pubkey: '12', uri: undefined},
];

const Home = (props: HomeProps) => {
  const [curPage, setCurPage] = useState(0);
  const [curItems, setCurItems] = useState<NFTItem[]>(items);
  const [stakedItems, setStakedItems] = useState<NFTItem[]>(items);
  const [balance, setBalance] = useState<number>();
  const [isActive, setIsActive] = useState(false); // true when countdown completes
  const [isSoldOut, setIsSoldOut] = useState(false); // true when items remaining is zero
  const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT

  const [itemsAvailable, setItemsAvailable] = useState(0);
  const [itemsRedeemed, setItemsRedeemed] = useState(0);
  const [itemsRemaining, setItemsRemaining] = useState(0);

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });

  const [startDate, setStartDate] = useState(new Date(props.startDate));

  const wallet = useAnchorWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();

  const refreshCandyMachineState = () => {
    (async () => {
      if (!wallet) return;

      const {
        candyMachine,
        goLiveDate,
        itemsAvailable,
        itemsRemaining,
        itemsRedeemed,
      } = await getCandyMachineState(
        wallet as anchor.Wallet,
        props.candyMachineId,
        props.connection
      );

      setItemsAvailable(itemsAvailable);
      setItemsRemaining(itemsRemaining);
      setItemsRedeemed(itemsRedeemed);

      setIsSoldOut(itemsRemaining === 0);
      setStartDate(goLiveDate);
      setCandyMachine(candyMachine);
    })();
  };

  const onMint = async (index: number) => {
    try {
      setIsMinting(true);
      if (wallet && candyMachine?.program) {
        if (curItems.length <= index) throw `Out of item index range`;

        console.log(`--> Transfer ${curItems[index].pubkey}\
         from ${wallet.publicKey.toString()} to ${OWNER_WALLET_PUBKEY}`);

        const connection = props.connection;
        const tokenMintPubkey = new PublicKey(curItems[index].pubkey);
        const sourcePubkey = await getTokenWallet(wallet.publicKey, tokenMintPubkey);
        const destinationPubkey = await getTokenWallet(new PublicKey(OWNER_WALLET_PUBKEY), tokenMintPubkey);
        
        const createATAIx = createAssociatedTokenAccountInstruction(
          destinationPubkey,
          wallet.publicKey,
          new PublicKey(OWNER_WALLET_PUBKEY),
          tokenMintPubkey,
        );

        const transferIx = Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          sourcePubkey,
          destinationPubkey,
          wallet.publicKey,
          [],
          1
        );

        const instructions = [createATAIx, transferIx];

        let tx = new Transaction().add(...instructions);
        tx.setSigners(
          ...([wallet.publicKey]),
        );
        tx.recentBlockhash = (await connection.getRecentBlockhash("max")).blockhash;
        let signed = await wallet.signTransaction(tx);
        let txid = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'singleGossip'
        });
        const transferTxId = await connection.confirmTransaction(txid, 'singleGossip');

        let newItems = Object.assign(curItems);
        newItems.splice(index, 1);
        setCurItems(newItems);
        
        const result = await axios.post('http://localhost:4040/api/claim-staked', {
          address: wallet.publicKey.toBase58(),
        });
        console.log(result);

        // const mintTxId = await mintOneToken(
        //   candyMachine,
        //   props.config,
        //   wallet.publicKey,
        //   props.treasury
        // );
        const status = transferTxId.value;
        // const status = await awaitTransactionSignatureConfirmation(
        //   mintTxId,
        //   props.txTimeout,
        //   props.connection,
        //   "singleGossip",
        //   false
        // );

        if (!status?.err) {
          setAlertState({
            open: true,
            message: "Congratulations! Mint succeeded!",
            severity: "success",
          });
        } else {
          setAlertState({
            open: true,
            message: "Mint failed! Please try again!",
            severity: "error",
          });
        }
      }
    } catch (error: any) {
      // TODO: blech:
      let message = error.msg || error.message || "Minting failed! Please try again!";
      if (!error.msg) {
        if (error.message.indexOf("0x138")) {
        } else if (error.message.indexOf("0x137")) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          setIsSoldOut(true);
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }
      console.log(error);
      setAlertState({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
      setIsMinting(false);
      // refreshCandyMachineState();
    }
  };

  useEffect(() => {
    (async () => {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
        const nftAccounts = await getParsedNftAccountsByOwner({
          publicAddress: wallet.publicKey,
          connection: props.connection,
        })
        if (nftAccounts.length > 0) {
          // Parse transaction and get raw wallet activities
          let nfts = [] as any, parsedCount = 0;
          const parsedNFTs = await Promise.allSettled(
          nftAccounts.map((account: any, index: number) => {
              axios.get(account.data.uri).then((result) => {
                if(nfts.length > index) nfts[index].uri = result.data.image;
                parsedCount++;
              }).catch (err => {
                console.log(err); // eslint-disable-line
                parsedCount++;
              });
              return {
                pubkey: account.mint,
                uri: account.data.uri, //result.data.image ?? 'https://picsum.photos/200/200',
              };
            })
          );
          
          nfts = parsedNFTs
            .filter(({ status }) => status === "fulfilled")
            .flatMap((p) => (p as PromiseFulfilledResult<any>).value);
          
          let interval = 0 as any;
          interval = setInterval(() => {
            if(parsedCount == nftAccounts.length) clearInterval(interval);
            setCurItems(nfts);
          }, 500);
        }
      } else {
        setCurItems(curItems);
        setCurPage(0);
      }
    })();
  }, [wallet, props.connection]);

  useEffect(refreshCandyMachineState, [
    wallet,
    props.candyMachineId,
    props.connection,
  ]);

  return (
    <main style={{position: 'relative'}}>
      <div style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        minHeight: 100,
      }}
      >
        {wallet && <span style={{width: 80, cursor: 'pointer', margin: 20}} onClick={() => {
          setCurPage(0);
        }}>Home</span>}
        {wallet && <span style={{width: 80, cursor: 'pointer', margin: 20}} onClick={() => {
          setCurPage(1);
        }}>My heroes</span>}
      </div>
      {wallet && (
        <div style={{width: '100%', display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
          <div>
            <p>Total Available: {itemsAvailable}</p>
            <p>Redeemed: {itemsRedeemed}</p>
            <p>Remaining: {itemsRemaining}</p>
          </div>
          <div>
            <p>Wallet {shortenAddress(wallet.publicKey.toBase58() || "")}</p>
            <p>Balance: {(balance || 0).toLocaleString()} SOL</p>
          </div>
        </div>
      )}

      <MintContainer>
        {!wallet ? (
          <>
          <ConnectButton style={{position: 'absolute', right: 0, top: 0}}>Connect Wallet</ConnectButton>
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: 1100
          }}>
            { indexes.map((item, idx) => 
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                width: 200,
                margin: 30,
              }}>
                <div
                  style={{
                    position: 'relative',
                    backgroundColor: 'rgba(50, 50, 0, 0.5)',
                  }}
                  >
                  <img
                    alt={'back' + idx}
                    src={Skeleton}
                    width={200}
                    height={200}
                    style={{
                      backgroundColor: 'rgba(50, 50, 0, 0.5)',
                      zIndex: -1,
                    }}
                  />
                </div>
                <MintButton
                  disabled={true}
                  onClick={() => {}}
                  variant="contained"
                >
                  MINT
                </MintButton>
              </div>
            )}
          </div>
          </>
        ) : 
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: 1100
        }}
        >
          {(curPage == 0 ? curItems : stakedItems).map((item, idx) => 
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              width: 200,
              margin: 30,
            }}>
              <div
                style={{
                  position: 'relative',
                  backgroundColor: 'rgba(50, 50, 0, 0.5)',
                }}
                >
                <img
                  alt={'' + idx}
                  src={item.uri || "https://placeimg.com/200/200/"+idx}
                  style={{
                    minWidth: 200,
                    maxWidth: 200,
                    minHeight: 200,
                    maxHeight: 200,
                    zIndex: 1,
                  }}
                />
                <span>{item.pubkey}</span>
                <img
                  alt={'back' + idx}
                  src={Skeleton}
                  width={200}
                  height={200}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    backgroundColor: 'rgba(50, 50, 0, 0.5)',
                    zIndex: -1,
                  }}
                />
              </div>
              <MintButton
                disabled={isMinting}// || isSoldOut || !isActive}
                onClick={() => {onMint(idx)}}
                variant="contained"
              >
                {isSoldOut ? (
                  "STAKE"
                ) : isActive ? (
                  isMinting ? (
                    <CircularProgress />
                  ) : (
                    "STAKE"
                  )
                ) : (
                  <Countdown
                    date={startDate}
                    onMount={({ completed }) => completed && setIsActive(true)}
                    onComplete={() => setIsActive(true)}
                    renderer={renderCounter}
                  />
                )}
              </MintButton>
            </div>
          )}
        </div>
        }
      </MintContainer>

      <Snackbar
        open={alertState.open}
        autoHideDuration={6000}
        onClose={() => setAlertState({ ...alertState, open: false })}
      >
        <Alert
          onClose={() => setAlertState({ ...alertState, open: false })}
          severity={alertState.severity}
        >
          {alertState.message}
        </Alert>
      </Snackbar>
    </main>
  );
};

interface AlertState {
  open: boolean;
  message: string;
  severity: "success" | "info" | "warning" | "error" | undefined;
}

const renderCounter = ({ days, hours, minutes, seconds, completed }: any) => {
  return (
    <CounterText>
      {hours + (days || 0) * 24} hours, {minutes} minutes, {seconds} seconds
    </CounterText>
  );
};

export default Home;
