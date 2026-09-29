#!/bin/bash
set -e
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
echo "=== Installing Rust ==="
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
source "$HOME/.cargo/env"
rustc --version
echo "=== Installing Solana CLI ==="
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version
echo "=== Installing Anchor via avm ==="
cargo install --git https://github.com/solana-foundation/anchor avm --locked || cargo install --git https://github.com/coral-xyz/anchor avm --locked
export PATH="$HOME/.avm/bin:$PATH"
avm install latest
avm use latest
anchor --version
echo "=== DONE ==="
