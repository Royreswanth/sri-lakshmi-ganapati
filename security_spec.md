# LineBook Pro — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Authenticated & Verified Identity Only**: Zero anonymous or unverified access. Every read and write MUST present `request.auth != null` and `request.auth.token.email_verified == true`.
2. **Strict UID Isolation (PII Protection)**: Every document in `/users/{userId}` and `/users/{userId}/backups/{backupId}` is private PII + financial ledger data belonging exclusively to `request.auth.uid == userId`. Cross-user reads, blanket queries, and root `users` collection listing are strictly denied.
3. **Master Gate & Atomic Parent Sync**: A backup snapshot in `/users/{userId}/backups/{backupId}` cannot be created without its parent `/users/{userId}` existing (or being atomically created/updated in the same `writeBatch` with `existsAfter` / `getAfter` verifying `ownerId == request.auth.uid`).
4. **Immutable Ledger Snapshots & Fields**: Backup snapshots in `/users/{userId}/backups/{backupId}` are append-only checkpoints (`allow update: if false;`), and `ownerId` + `createdAt` on `/users/{userId}` are immutable after creation.
5. **Temporal Integrity & Bounded Payloads**: `createdAt` and `updatedAt` MUST match `request.time`. All IDs match `^[a-zA-Z0-9_\-]+$` (<= 128 chars), strings have explicit `maxLength` bounds, numbers are clamped, and native Firestore maps/lists are used instead of `JSON.stringify` blobs, with bounded list element guards (`villages.size() <= 500`, `slg_exp.size() <= 5000`, `slg_newloans.size() <= 5000`, `slg_personal.size() <= 5000`).

---

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)

1. **Unauthenticated Device-ID Access (Anonymous / No Token)**
   - Attempt `get` or `create` on `/users/device_lender_1` with `auth: null`. -> **DENIED**
2. **Unverified Email Spoof Attack**
   - Attempt `create` on `/users/uid_alice` with `auth: { uid: "uid_alice", token: { email: "alice@gmail.com", email_verified: false } }`. -> **DENIED**
3. **Cross-Tenant PII Read (Non-Owner Get)**
   - User `uid_bob` (`email_verified: true`) attempts `get` on `/users/uid_alice`. -> **DENIED**
4. **Root Users Collection Enumeration (`allow list` Scraping)**
   - User `uid_bob` (`email_verified: true`) attempts `list` on `/users`. -> **DENIED**
5. **Ownership Hijack (`ownerId` Mismatch in Payload)**
   - User `uid_bob` creates `/users/uid_bob/backups/bk_1` with `ownerId: "uid_alice"`. -> **DENIED**
6. **Shadow / Ghost Field Injection (Create)**
   - User `uid_alice` creates `/users/uid_alice` with extra field `isAdmin: true` or `subscriptionOverride: "lifetime"`. -> **DENIED**
7. **Update-Gap / Field Privilege Escalation (Mutable `ownerId` or `createdAt`)**
   - User `uid_alice` updates `/users/uid_alice` changing `ownerId` or `createdAt`. -> **DENIED**
8. **Fake Client-Side Timestamp Spoofing**
   - User `uid_alice` creates `/users/uid_alice/backups/bk_2` with backdated `createdAt: "2020-01-01T00:00:00Z"` instead of server `request.time`. -> **DENIED**
9. **Path ID Poisoning / Resource Exhaustion**
   - User `uid_alice` creates `/users/uid_alice/backups/bad$id..with.dots` or a 256-character `backupId`. -> **DENIED**
10. **Raw JSON String / Shadow Ledger Key Injection**
    - User `uid_alice` creates `/users/uid_alice/backups/bk_3` containing an unexpected key inside `ledger` (`ledger.maliciousKey = "x"`) or passing `villages` as a string instead of a `list`. -> **DENIED**
11. **Mutating Immutable Backup Snapshot (`allow update: if false`)**
    - User `uid_alice` attempts to tamper/update `/users/uid_alice/backups/bk_1` after creation. -> **DENIED**
12. **Orphaned Backup Write / Blind `allow list` Without Owner Query Filter**
    - User `uid_alice` creates `/users/uid_alice/backups/bk_orphan` without parent `/users/uid_alice` existing (no atomic batch), OR runs a list query on `/users/uid_alice/backups` when `resource.data.ownerId` check fails. -> **DENIED**
13. **Non-Admin SaaS License Forgery / Revocation Tampering (`/licenses/{licenseId}`)**
    - User `uid_alice` (`alice@gmail.com`) attempts to `create`, `update`, or `delete` `/licenses/LBP-ALICE-0001` to self-grant a subscription or bypass revocation. -> **DENIED** (Strictly `isAdmin()` verified `reswanth6789@gmail.com` only).
14. **Cross-Tenant License Enumeration / Empty Email Probe (`/licenses/{licenseId}`)**
    - User `uid_bob` (`bob@gmail.com`) attempts to `get` or `list` a `/licenses` document belonging to `alice@gmail.com` or an unlinked license (`lenderEmail: ""`). -> **DENIED**

