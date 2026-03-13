import * as crypto from 'node:crypto';

export const randomBytes = (length: number): Uint8Array => {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
}

// @TODO -- use this and test it
export const getRandomBigInt = (): bigint => {
    return BigInt(crypto.randomInt(10));
};