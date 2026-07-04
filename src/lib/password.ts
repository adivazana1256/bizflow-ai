import { hash, verify } from "@node-rs/argon2";

export const hashPassword = (plain: string) => hash(plain);
export const verifyPassword = (digest: string, plain: string) => verify(digest, plain);
