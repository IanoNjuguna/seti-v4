-- Savings moves money between the spendable balance and a Tempo Earn vault, and
-- the ledger had no word for it. Two kinds of movement, not one:
--
--   savings_deposit     — the customer put money in. Written from the receipt of ONE
--                         transaction carrying three calls (swap into the vault's
--                         asset, approval, deposit), so the row's `amount` is what
--                         reached the vault and `metadata.savings` explains the swap.
--   savings_withdrawal  — the mirror: redeem, then swap home. The row's amount is
--                         what reached the customer.
--
-- Additive only, no column changes. Every reader that switches on the existing
-- values treats an unknown one as "not a spend", which is right for both.
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'savings_deposit';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'savings_withdrawal';
