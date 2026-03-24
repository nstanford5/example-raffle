// witness stuff
// make compiled contract

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import path from 'node:path';

// @TODO -- explicit exports required?
export {
    Contract,
    ledger,
    pureCircuits,
    WinnerState,
    type Ledger,
    type Witnesses,
    type ImpureCircuits,
    type PureCircuits,
} from './managed/raffle/contract/index.js';

import { WinnerState, Contract, type Witnesses, type Ledger } from './managed/raffle/contract/index.js';
import { WitnessContext } from '@midnight-ntwrk/compact-runtime';

export type RafflePrivateState = {
    address: string,
    sk: Uint8Array,
};

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

const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');
export const zkConfigPath = path.resolve(currentDir, 'managed', 'raffle');

export const CompiledRaffleContract = CompiledContract.make(
    'RaffleContract',
    Contract,
).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
);