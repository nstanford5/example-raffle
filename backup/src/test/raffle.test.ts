import { RaffleSimulator, WalletBuilder } from './raffle-simulator.js';
import { NetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { describe, it, expect } from 'vitest';
import { WinnerState } from '../managed/hidden-num-raffle/contract/index.js';

setNetworkId('undeployed' as NetworkId);

describe("Raffle Smart Contract", () => {
    it("executes the constructor correctly", () => {
        const sim = new RaffleSimulator(BigInt(5));
        const aliceDappPubKey = sim.publicKey(sim.aliceSk);

        const ledgerState = sim.getLedger();
        expect(ledgerState.assignedNumbers).toEqual(0n);
        expect(ledgerState.winState).toEqual(WinnerState.UNSET);
        expect(ledgerState.raffleOrganizer).toEqual(aliceDappPubKey);
    });
    it('allows getTicket', () => {
        const sim = new RaffleSimulator(BigInt(5));

        const bob = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(bob.callerContext);
        sim.getTicket();

        const claire = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(claire.callerContext);
        sim.getTicket();

        const darren = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(darren.callerContext);
        sim.getTicket();

        const ezra = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(ezra.callerContext);
        sim.getTicket();

 
        const ledgerState = sim.getLedger();

        expect(ledgerState.assignedNumbers).toEqual(4n);
        bob.updateCallerContext(sim.getContractState());
        sim.switchCallers(bob.callerContext);
        expect(() => {
            sim.getTicket();
        }).toThrow("You are already in the list");

        claire.updateCallerContext(sim.getContractState());
        sim.switchCallers(claire.callerContext);
        expect(() => {
            sim.getTicket();
        }).toThrow("You are already in the list");

        const fred = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(fred.callerContext);
        sim.getTicket();

        const greg = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(greg.callerContext);
        sim.getTicket();

        const harlod = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(harlod.callerContext);
        sim.getTicket();

        const idris = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(idris.callerContext);
        sim.getTicket();

        const joe = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(joe.callerContext);
        sim.getTicket();

        // 10
        const kat = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(kat.callerContext);
        sim.getTicket();

        const newLedgerState = sim.getLedger();

        expect(newLedgerState.assignedNumbers).toEqual(10n);
        const larry = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(larry.callerContext);
        expect(() => {
            sim.getTicket();
        }).toThrow("Max tickets reached");
    });
    it('Reveals the winning number', () => {
        const winningNum = BigInt(5)
        const sim = new RaffleSimulator(winningNum);

        const bob = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(bob.callerContext);
        sim.getTicket();

        const claire = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(claire.callerContext);
        sim.getTicket();

        const darren = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(darren.callerContext);
        sim.getTicket();

        const ezra = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(ezra.callerContext);
        sim.getTicket();
 
        const ledgerState = sim.getLedger();

        expect(ledgerState.assignedNumbers).toEqual(4n);
        bob.updateCallerContext(sim.getContractState());
        sim.switchCallers(bob.callerContext);
        expect(() => {
            sim.getTicket();
        }).toThrow("You are already in the list");

        claire.updateCallerContext(sim.getContractState());
        sim.switchCallers(claire.callerContext);
        expect(() => {
            sim.getTicket();
        }).toThrow("You are already in the list");

        const fred = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(fred.callerContext);
        sim.getTicket();

        const greg = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(greg.callerContext);
        sim.getTicket();

        const harlod = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(harlod.callerContext);
        sim.getTicket();

        const idris = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(idris.callerContext);
        sim.getTicket();

        const joe = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(joe.callerContext);
        sim.getTicket();

        // 10
        const kat = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(kat.callerContext);
        sim.getTicket();
        
        // all tickets out, reveal a winner (not an organizer)
        expect(() => {
            sim.revealWinner(winningNum);
        }).toThrow("You are not the organizer");

        // organizer reveals
        sim.updateAliceContext(sim.getContractState());
        sim.revealWinner(winningNum);

        const finalLedgerState = sim.getLedger();
        expect(finalLedgerState.assignedNumbers).toEqual(10n);
        expect(finalLedgerState.publicWinningNum).toEqual(winningNum);
    });
    it('allows winner to claim', () => {
        const winningNum = BigInt(5)
        const sim = new RaffleSimulator(winningNum);

        const bob = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(bob.callerContext);
        sim.getTicket();

        const claire = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(claire.callerContext);
        sim.getTicket();

        const darren = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(darren.callerContext);
        sim.getTicket();

        const ezra = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(ezra.callerContext);
        sim.getTicket();
 
        const ledgerState = sim.getLedger();

        expect(ledgerState.assignedNumbers).toEqual(4n);
        bob.updateCallerContext(sim.getContractState());
        sim.switchCallers(bob.callerContext);
        expect(() => {
            sim.getTicket();
        }).toThrow("You are already in the list");

        claire.updateCallerContext(sim.getContractState());
        sim.switchCallers(claire.callerContext);
        expect(() => {
            sim.getTicket();
        }).toThrow("You are already in the list");

        const fred = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(fred.callerContext);
        sim.getTicket();

        const greg = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(greg.callerContext);
        sim.getTicket();

        const harlod = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(harlod.callerContext);
        sim.getTicket();

        const idris = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(idris.callerContext);
        sim.getTicket();

        const joe = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(joe.callerContext);
        sim.getTicket();

        // 10
        const kat = new WalletBuilder(sim.contractAddress, sim.getContractState());
        sim.switchCallers(kat.callerContext);
        sim.getTicket();
        
        // all tickets out, reveal a winner (not an organizer)
        expect(() => {
            sim.revealWinner(winningNum);
        }).toThrow("You are not the organizer");

        // organizer reveals
        sim.updateAliceContext(sim.getContractState());
        sim.revealWinner(winningNum);

        const finalLedgerState = sim.getLedger();
        expect(finalLedgerState.assignedNumbers).toEqual(10n);
        expect(finalLedgerState.publicWinningNum).toEqual(winningNum);

        kat.updateCallerContext(sim.getContractState());
        sim.switchCallers(kat.callerContext);
        // claim win
        expect(() => {
            sim.claimWin(kat.address);
        }).toThrow("You do not have the winning number");
        
        fred.updateCallerContext(sim.getContractState());
        sim.switchCallers(fred.callerContext);

        // should I remove the address param from claim win? 
        sim.claimWin(fred.address);
        const finalFinalLedgerState = sim.getLedger();
        expect(finalFinalLedgerState.winState).toEqual(WinnerState.SET);

        const winnerDappPubKey = sim.publicKey(fred.sk);
        expect(finalFinalLedgerState.winner).toEqual(winnerDappPubKey);
    });
    // it('blocks out of bounds numbers', () => {
    //     expect(() => {
    //         const sim = new RaffleSimulator(BigInt(11));
    //     }).toThrow("Winning number must be between 1-10");
    //     expect(() => {
    //         const sim = new RaffleSimulator(BigInt(0));
    //     }).toThrow("Winning number must be between 1-10");
    // });
    // it('forces correct revealing of the winning number', () => {
    //     const winningNum = BigInt(1);
    //     const sim = new RaffleSimulator(winningNum);
    //     // create 10 wallets
    //     const bob = new WalletBuilder();
    //     const claire = new WalletBuilder();
    //     const darren = new WalletBuilder();
    //     const ezra = new WalletBuilder();
    //     const fred = new WalletBuilder();
    //     const greg = new WalletBuilder();
    //     const harold = new WalletBuilder();
    //     const idris = new WalletBuilder();
    //     const joe = new WalletBuilder();
    //     const kat = new WalletBuilder();// 10

    //     // get 10 tickets
    //     sim.getTicket(bob.sk);
    //     sim.getTicket(claire.sk);
    //     sim.getTicket(darren.sk);
    //     sim.getTicket(ezra.sk);
    //     sim.getTicket(fred.sk);
    //     sim.getTicket(greg.sk);
    //     sim.getTicket(harold.sk);
    //     sim.getTicket(idris.sk);
    //     sim.getTicket(joe.sk);
    //     sim.getTicket(kat.sk);

    //     expect(() => {
    //         sim.revealWinner(BigInt(5), sim.aliceSk);
    //     }).toThrow("Wrong winning number provided, shame on you");

    //     sim.revealWinner(winningNum, sim.aliceSk);
    //     const ledgerState = sim.getLedger();

    //     expect(ledgerState.publicWinningNum).toEqual(winningNum);
    // });
})