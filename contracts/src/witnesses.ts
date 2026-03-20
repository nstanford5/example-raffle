import { Ledger } from './managed/hidden-num-raffle/contract/index.js';
import { WitnessContext } from '@midnight-ntwrk/compact-runtime';

export type RafflePrivateState = {
    address: string,
    sk: Uint8Array
}

export const createRafflePrivateState = (address: string, sk: Uint8Array) => ({
    address,
    sk
});

export const witnesses = {
    localSk: ({
        privateState
    }: WitnessContext<Ledger, RafflePrivateState>): [
        RafflePrivateState,
        Uint8Array
    ] => {
        return [privateState, privateState.sk];
    }
};