import {
    type CircuitContext,
    sampleContractAddress,
    createConstructorContext,
    CostModel,
    QueryContext,
    sampleUserAddress,
    encodeUserAddress,
    ChargedState,
    createCircuitContext
} from "@midnight-ntwrk/compact-runtime";
import { 
    Contract,
    type Ledger,
    ledger,
    WinnerState,
 } from "../managed/hidden-num-raffle/contract/index.js";
import { 
    type RafflePrivateState, 
    createRafflePrivateState,
    witnesses
} from "../witnesses.js";
import { randomBytes } from './utils.js';



export class RaffleSimulator {
    readonly contract: Contract<RafflePrivateState>;
    contractAddress: string;
    aliceAddress: string;
    alicePrivateState: RafflePrivateState;
    aliceSk: Uint8Array;
    circuitContext: CircuitContext<RafflePrivateState>;
    amount: bigint;

    constructor(winningNum: bigint) {
        this.contract = new Contract<RafflePrivateState>(witnesses);
        this.contractAddress = sampleContractAddress();
        this.aliceAddress = sampleUserAddress();
        this.aliceSk = randomBytes(32);
        this.alicePrivateState = createRafflePrivateState(this.aliceAddress, this.aliceSk);
        this.amount = 100n;// arbitrary

        const {
            currentPrivateState,
            currentContractState,
            currentZswapLocalState
        } = this.contract.initialState(
            createConstructorContext(this.alicePrivateState, this.aliceAddress),
            winningNum,
            this.amount,
        );
        this.circuitContext = {
            currentPrivateState,
            currentZswapLocalState,
            costModel: CostModel.initialCostModel(),
            currentQueryContext: new QueryContext(
                currentContractState.data,
                this.contractAddress
            ),
        };
    }// end of constructor
    // smart contract circuit wrappers
    public publicKey(sk: Uint8Array): Uint8Array {
        return this.contract.circuits.publicKey(
            this.circuitContext,
            sk
        ).result;
    }

    public getTicket(): void {
        this.circuitContext = this.contract.impureCircuits.getTicket(
            this.circuitContext,
        ).context;
    }

    public revealWinner(winningNum: bigint): void {
        this.circuitContext = this.contract.impureCircuits.revealWinner(
            this.circuitContext,
            winningNum,
        ).context;
    }

    public claimWin(address: string): void {
        this.circuitContext = this.contract.impureCircuits.claimWin(
            this.circuitContext,
            { bytes: encodeUserAddress(address) },// encode string->Uint8Array
        ).context;
    }

    // helper functions
    public getLedger(): Ledger {
        return ledger(this.circuitContext.currentQueryContext.state);
    }
    
    public switchCallers(callerContext: CircuitContext): void {
        this.circuitContext = callerContext;
    }

    public updateAliceContext(contractState: ChargedState): void {
        this.circuitContext = createCircuitContext(
            this.contractAddress,
            this.aliceAddress,
            contractState,
            this.alicePrivateState
        )
    }

    public getContractState(): ChargedState {
        return this.circuitContext.currentQueryContext.state;
    }
}

export class WalletBuilder {
    address: string;
    sk: Uint8Array;
    contractAddress: string;
    privateState: RafflePrivateState;
    callerContext: CircuitContext<RafflePrivateState>;

    constructor(contractAddress: string, contractState: ChargedState){
        this.address = sampleUserAddress();
        this.sk = randomBytes(32);
        this.contractAddress = contractAddress;
        this.privateState = createRafflePrivateState(
            this.address,
            this.sk
        );
        this.callerContext = createCircuitContext(
            this.contractAddress,
            this.address,
            contractState,
            this.privateState
        );
    }
    public updateCallerContext(contractState: ChargedState): void {
        this.callerContext = createCircuitContext(
            this.contractAddress,
            this.address,
            contractState,
            this.privateState
        );
    }
}
