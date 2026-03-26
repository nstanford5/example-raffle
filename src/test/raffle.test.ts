import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
    createUnprovenDeployTx,
    submitCallTx,
    deployContract,
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

const ALICE_PRIVATE_STATE_ID = 'AlicePrivateRaffleState';
const BOB_PRIVATE_STATE_ID = 'BobPrivateRaffleState';
const CLAIRE_PRIVATE_STATE_ID = 'ClairePrivateRaffleState';

const logger = pino({
    level: process.env['LOG_LEVEL'] ?? 'info',
    transport: { target: 'pino-pretty' },
});

describe('Raffle Smart Contract', () => {
    let aliceWallet: MidnightWalletProvider;
    let bobWallet: MidnightWalletProvider;
    let claireWallet: MidnightWalletProvider;
    let aliceProviders: RaffleProviders;
    let bobProviders: RaffleProviders;
    let claireProviders: RaffleProviders;
    let contractAddress: ContractAddress;

    const config = getConfig();
    const seed = LOCAL_DEV_SEED;
    const seed2 = BOB_SEED;
    const seed3 = CLAIRE_SEED;
    const winningNum = BigInt(1);
    const amount = BigInt(10);

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

        aliceProviders = buildProviders(aliceWallet, zkConfigPath, config);
        bobProviders = buildProviders(bobWallet, zkConfigPath, config);
        claireProviders = buildProviders(claireWallet, zkConfigPath, config);
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
    });

    it('Deploys the contract', async () => {
        const aliceSk = randomBytes(32);
        const initialPrivateState = createRafflePrivateState(aliceWallet.getCoinPublicKey(), aliceSk);

        // Option #1: manually work through each step of the process allowing flexibility
        // Step 1: local circuit execution
        // createUnprovenDeployTx is the reason for the Steps that follow
        const unprovenData: any = await (createUnprovenDeployTx as any)(aliceProviders, {
            compiledContract: CompiledRaffleContract,
            privateStateId: ALICE_PRIVATE_STATE_ID,
            initialPrivateState,
            args: [winningNum, amount]// contract constructor args
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

        // Option #2: deployContract as an abstraction
        // const deployed: any = await 
        //     (deployContract as any)(aliceProviders, {
        //         compiledContract: CompiledRaffleContract,
        //         privateStateId: ALICE_PRIVATE_STATE_ID,
        //         initialPrivateState,
        //         args: [winningNum, amount],
        //     },
        // );

        // Store private state (normally done inside deployContract)
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
        expect(initialState.raffleAmount).toEqual(amount);
        expect(initialState.assignedNumbers).toEqual(0n);
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

        // @TODO -- request local net with more pre-funded addresses
    });
    it('blocks tickets to Alice', async () => {
                // alice is not allowed to get a ticket
        await expect(async () => {
            await (submitCallTx as any)(aliceProviders, {
                compiledContract: CompiledRaffleContract,
                contractAddress,
                privateStateId: ALICE_PRIVATE_STATE_ID,
                circuitId: 'getTicket',
                args: []
            })
        }).rejects.toThrow();
    });
    it('blocks duplicate tickets', async () => {
        await expect(async () => {
            await (submitCallTx as any)(bobProviders, {
                compiledContract: CompiledRaffleContract,
                contractAddress,
                privateStateId: BOB_PRIVATE_STATE_ID,
                circuitId: 'getTicket',
                args: [],
            })
        }).rejects.toThrow();

        await expect(async () => {
            await (submitCallTx as any)(claireProviders, {
                compiledContract: CompiledRaffleContract,
                contractAddress,
                privateStateId: CLAIRE_PRIVATE_STATE_ID,
                circuitId: 'getTicket',
                args: []
            })
        }).rejects.toThrow();
    });
    it('rejects non-organizer from revealing winner', async () => {
        await expect(async () => {
            await (submitCallTx as any)(bobProviders, {
                compiledContract: CompiledRaffleContract,
                contractAddress,
                privateStateId: BOB_PRIVATE_STATE_ID,
                circuitId: 'revealWinner',
                args: [winningNum]
            })
        }).rejects.toThrow();
    });
    it('allows the organizer to reveal the winner', async () => {
        await (submitCallTx as any)(aliceProviders, {
            compiledContract: CompiledRaffleContract,
            contractAddress,
            privateStateId: ALICE_PRIVATE_STATE_ID,
            circuitId: 'revealWinner',
            args: [winningNum]
        });

        const finalLedgerState = await aliceProviders.publicDataProvider.queryContractState(contractAddress);
        expect(finalLedgerState).not.toBeNull();
        const finalState = ledger(finalLedgerState!.data);
        expect(finalState.winState).toEqual(WinnerState.SET);
        expect(finalState.publicWinningNum).toEqual(winningNum);
    });
    it('rejects non winner from claiming', async () => {
        const claireAddress = new Uint8Array(
            (claireWallet.getCoinPublicKey() as string)
                .match(/.{1,2}/g)!
                .map((b: string) => parseInt(b, 16)),
        );

        await expect(async () => {
            await (submitCallTx as any)(claireProviders, {
                compiledContract: CompiledRaffleContract,
                contractAddress,
                privateStateId: CLAIRE_PRIVATE_STATE_ID,
                circuitId: 'claimWin',
                args: [{ bytes: claireAddress }]
            });
        }).rejects.toThrow();
    });
    it('allows claim from winner', async () => {
        // @TODO -- is there an encoding function for this?
        const bobAddress = new Uint8Array(
            (bobWallet.getCoinPublicKey() as string)
                .match(/.{1,2}/g)!
                .map((b: string) => parseInt(b, 16)),
        );

        await (submitCallTx as any)(bobProviders, {
            compiledContract: CompiledRaffleContract,
            contractAddress,
            privateStateId: BOB_PRIVATE_STATE_ID,
            circuitId: 'claimWin',
            args: [{ bytes: bobAddress }]
        });
    })
})