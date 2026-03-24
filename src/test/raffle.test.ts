import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
    createUnprovenDeployTx,
    submitCallTx,
} from '@midnight-ntwrk/midnight-js-contracts';
import type { ContractAddress } from '@midnight-ntwrk/compact-runtime';
import pino from 'pino';

import { getConfig } from '../config.js';
import { MidnightWalletProvider, syncWallet } from '../wallet.js';
import { buildProviders, type RaffleProviders } from '../providers.js';
import {
    CompiledRaffleContract,
    createRafflePrivateState,
    ledger,
    WinnerState,
    zkConfigPath
} from '../../contract/index.js';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';

// Catch unhandled rejections so vitest doesn't silently exit
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  console.error('Promise:', promise);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
// Genesis seed for local dev node — pre-funded with tokens
const LOCAL_DEV_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
const BOB_SEED = '0000000000000000000000000000000000000000000000000000000000000002';
const CLAIRE_SEED = '0000000000000000000000000000000000000000000000000000000000000003';
const DON_SEED = '0000000000000000000000000000000000000000000000000000000000000004';

const ALICE_PRIVATE_STATE_ID = 'AlicePrivateRaffleState';
const BOB_PRIVATE_STATE_ID = 'BobPrivateRaffleState';
const CLAIRE_PRIVATE_STATE_ID = 'ClairePrivateRaffleState';
const DON_PRIVATE_STATE_ID = 'DonPrivateRaffleState';

const logger = pino({
    level: process.env['LOG_LEVEL'] ?? 'info',
    transport: { target: 'pino-pretty' },
});

describe('Raffle Smart Contract', () => {
    let aliceWallet: MidnightWalletProvider;
    let bobWallet: MidnightWalletProvider;
    let claireWallet: MidnightWalletProvider;
    let donWallet: MidnightWalletProvider;
    let aliceProviders: RaffleProviders;
    let bobProviders: RaffleProviders;
    let claireProviders: RaffleProviders;
    let donProviders: RaffleProviders;
    let contractAddress: ContractAddress;

    const config = getConfig();
    const seed = LOCAL_DEV_SEED;
    const seed2 = BOB_SEED;
    const seed3 = CLAIRE_SEED;
    const seed4 = DON_SEED;

    beforeAll(async () => {
        setNetworkId(config.networkId);

        const envConfig: EnvironmentConfiguration = {
            walletNetworkId: config.networkId,
            networkId: config.networkId,
            indexer: config.indexer,
            indexerWS: config.indexerWS,
            node: config.node,
            nodeWS: config.nodeWS,
            faucet: config.faucet,
            proofServer: config.proofServer,
        };

        aliceWallet = await MidnightWalletProvider.build(logger, envConfig, seed!);
        await aliceWallet.start();
        await syncWallet(logger, aliceWallet.wallet, 600_000);

        bobWallet = await MidnightWalletProvider.build(logger, envConfig, seed2!);
        await bobWallet.start();
        await syncWallet(logger, bobWallet.wallet, 600_000);
        
        claireWallet = await MidnightWalletProvider.build(logger, envConfig, seed3!);
        await claireWallet.start();
        await syncWallet(logger, claireWallet.wallet, 600_000);

        donWallet = await MidnightWalletProvider.build(logger, envConfig, seed4!);
        await donWallet.start();
        await syncWallet(logger, donWallet.wallet, 600_000);

        aliceProviders = buildProviders(aliceWallet, zkConfigPath, config);
        bobProviders = buildProviders(bobWallet, zkConfigPath, config);
        claireProviders = buildProviders(claireWallet, zkConfigPath, config);
        donProviders = buildProviders(donWallet, zkConfigPath, config);
        logger.info(`Providers initialized. Ready to test`);
    });

    afterAll(async () => {
        if(aliceWallet) {
            logger.info('Stopping Alice wallet...');
            await aliceWallet.stop();
        }
        if(bobWallet) {
            logger.info('Stopping Bob wallet...');
            await bobWallet.stop();
        }
        if(claireWallet) {
            logger.info('Stopping Claire wallet...');
            await claireWallet.stop();
        }
        if(donWallet) {
            logger.info('Stopping Don wallet...');
            await donWallet.stop();
        }
    });

    it('Deploys the contract', async () => {
        const aliceSk = randomBytes(32);
        const winningNum = BigInt(5);
        const amount = BigInt(10);
        const initialPrivateState = createRafflePrivateState(aliceWallet.getCoinPublicKey(), aliceSk);

        // Step 1: local circuit execution
        // createUnprovenDeployTx is the reason for the Steps that follow
        const unprovenData: any = await (createUnprovenDeployTx as any)(aliceProviders, {
            compiledContract: CompiledRaffleContract,
            privateStateId: ALICE_PRIVATE_STATE_ID,
            initialPrivateState,
            args: [winningNum, amount]// constructor args here (winningNum, amount)
        });

        const pendingAddress = unprovenData.public?.contractAddress;
        logger.info(`Unproven tx created. Pending contract address: ${pendingAddress}`);

        // Step 2: Prove (send to proof server, get ZK proof back)
        const provenTx = await aliceProviders.proofProvider.proveTx(unprovenData.private.unprovenTx);
        logger.info('proven tx received from proof server');

        // Step 3: Balance wallet
        const balancedTx = await aliceProviders.walletProvider.balanceTx(provenTx);
        logger.info('Balanced tx ready for submission');

        // Step 4: Submit (send to network node)
        const txId = await aliceProviders.midnightProvider.submitTx(balancedTx);
        logger.info(`Submitted tx id: ${txId}`);

        // Step 5: Watch the chain for the finalized txn
        const finalizedTxData = await aliceProviders.publicDataProvider.watchForTxData(txId);
        logger.info(`Finalized! Status: ${finalizedTxData.status}, block: ${finalizedTxData.blockHeight}`);

        // Store private state (normally done inside deployContract)
        // @TODO -- why is it occuring here?
        // Hypothesis: using createUnprovenDeployTx makes this necessary
        logger.info(`Setting the contract address...`);
        aliceProviders.privateStateProvider.setContractAddress(pendingAddress);
        await aliceProviders.privateStateProvider.set(ALICE_PRIVATE_STATE_ID, initialPrivateState);

        contractAddress = pendingAddress;
        logger.info(`Contract address: ${contractAddress}`);
        expect(contractAddress).toBeDefined();
        expect(contractAddress.length).toBeGreaterThan(0);

        // verify initial ledger state (constructor)
        const initialContractState = await aliceProviders.publicDataProvider.queryContractState(contractAddress);
        expect(initialContractState).not.toBeNull();
        const initialState = ledger(initialContractState!.data);
        expect(initialState.winState).toEqual(WinnerState.UNSET);
    });
    it('allows getTicket', async () => {
        // bob tries to buy a raffle ticket
        // what about bob? --> private state
        const bobSk = randomBytes(32);
        const bobPrivateState = createRafflePrivateState(bobWallet.getCoinPublicKey(), bobSk);
        bobProviders.privateStateProvider.setContractAddress(contractAddress);
        await bobProviders.privateStateProvider.set(BOB_PRIVATE_STATE_ID, bobPrivateState);
        
        // submitCallTx creates, proves and submits a circuit invocation txn and waits
        // for finalization before returning.
        const txData: any = await (submitCallTx as any)(bobProviders, {
            compiledContract: CompiledRaffleContract,
            contractAddress,
            privateStateId: BOB_PRIVATE_STATE_ID,
            circuitId: 'getTicket',
            args: []
        });

        const bobContractState = await bobProviders.publicDataProvider.queryContractState(contractAddress);
        expect(bobContractState).not.toBeNull();
        const bobState = ledger(bobContractState!.data);
        expect(bobState.assignedNumbers).toEqual(1n);
        // end Bob


        // start Claire
        const claireSk = randomBytes(32);
        const clairePrivateState = createRafflePrivateState(claireWallet.getCoinPublicKey(), claireSk);
        claireProviders.privateStateProvider.setContractAddress(contractAddress);
        await claireProviders.privateStateProvider.set(CLAIRE_PRIVATE_STATE_ID, clairePrivateState);
        
        const txData2: any = await (submitCallTx as any)(claireProviders, {
            compiledContract: CompiledRaffleContract,
            contractAddress,
            privateStateId: CLAIRE_PRIVATE_STATE_ID,
            circuitId: 'getTicket',
            args: []
        });

        // verify state changed via indexer
        const claireContractState = await claireProviders.publicDataProvider.queryContractState(contractAddress);
        expect(claireContractState).not.toBeNull();
        const claireState = ledger(claireContractState!.data);
        expect(claireState.assignedNumbers).toEqual(2n);

        // @TODO -- fails due to lack of funds
        // // start don
        // const donSk = randomBytes(32);
        // const donPrivateState = createRafflePrivateState(donWallet.getCoinPublicKey(), donSk);
        // donProviders.privateStateProvider.setContractAddress(contractAddress);
        // await donProviders.privateStateProvider.set(DON_PRIVATE_STATE_ID, donPrivateState);
        
        // const donTxData: any = await (submitCallTx as any)(donProviders, {
        //     compiledContract: CompiledRaffleContract,
        //     contractAddress,
        //     privateStateId: DON_PRIVATE_STATE_ID,
        //     circuitId: 'getTicket',
        //     args: []
        // });

        // // verify state changed via indexer
        // const donContractState = await donProviders.publicDataProvider.queryContractState(contractAddress);
        // expect(donContractState).not.toBeNull();
        // const donState = ledger(donContractState!.data);
        // expect(donState.assignedNumbers).toEqual(3n);


    });
})