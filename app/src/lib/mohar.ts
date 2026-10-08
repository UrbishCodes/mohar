import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import idl from "./mohar-idl.json";
import { PROGRAM_ID } from "./config";

export const programId = new PublicKey(PROGRAM_ID);
export const tokenProgramId = TOKEN_PROGRAM_ID;

export type EscrowStatusName =
  | "Funded"
  | "Delivered"
  | "Released"
  | "Refunded"
  | "Disputed"
  | "Resolved";

export interface EscrowAccount {
  publicKey: PublicKey;
  client: PublicKey;
  freelancer: PublicKey;
  arbiter: PublicKey;
  mint: PublicKey;
  seed: BN;
  amount: BN;
  deadline: BN;
  status: EscrowStatusName | { [k: string]: object };
  bump: number;
  vaultBump: number;
}

export function statusName(s: EscrowAccount["status"]): EscrowStatusName {
  if (typeof s === "string") return s as EscrowStatusName;
  // Anchor IDLs serialize enum variants lowercase ("funded"); normalize to
  // the capitalized form the UI compares against.
  const key = Object.keys(s)[0] ?? "";
  return (key.charAt(0).toUpperCase() + key.slice(1)) as EscrowStatusName;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getProgram(connection: Connection, wallet: unknown): any {
  const provider = new AnchorProvider(
    connection,
    wallet as never,
    { commitment: "confirmed" }
  );
  return new Program(idl as any, provider);
}

export async function findEscrowPda(
  client: PublicKey,
  seed: BN | number | bigint
): Promise<[PublicKey, number]> {
  const seedBuf = new BN(seed.toString()).toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddress(
    [Buffer.from("escrow"), client.toBuffer(), seedBuf],
    programId
  );
}

export async function findVaultPda(escrow: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [Buffer.from("vault"), escrow.toBuffer()],
    programId
  );
}

/** Ensure the wallet has an associated token account for the mint; create it if missing. */
export async function getOrCreateAta(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  sendTx: (tx: Transaction) => Promise<string>
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  try {
    await getAccount(connection, ata);
    return ata;
  } catch {
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(payer, ata, owner, mint)
    );
    await sendTx(tx);
    return ata;
  }
}

export { SystemProgram, TOKEN_PROGRAM_ID };
