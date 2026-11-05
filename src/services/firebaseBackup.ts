import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  deleteDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import {
  generateBackupPayload,
  restoreBackupPayload,
  BackupPayload,
  STORAGE_KEYS,
  DB,
} from "../utils/storage";

// Initialize Firebase App Singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export interface CloudBackupRecord {
  backupId: string;
  lenderId: string;
  businessName: string;
  exportedAt: string;
  version: string;
  villagesCount: number;
  borrowersCount: number;
  totalLent: number;
  dataJson: string;
  auto?: boolean;
}

// Generate or retrieve persistent local device ID for Path-A offline users
export function getLenderCloudId(): string {
  const existing = localStorage.getItem("slg_lender_cloud_id");
  if (existing) return existing;

  const profile = DB.get<any>(STORAGE_KEYS.PROFILE, {});
  const cleanName = (profile.businessName || "lender")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const newId = `lender_${cleanName}_${randomSuffix}`;
  localStorage.setItem("slg_lender_cloud_id", newId);
  return newId;
}

export function ensureFirebaseAuth(): string {
  if (auth.currentUser) return auth.currentUser.uid;
  return getLenderCloudId();
}

/**
 * Upload complete LineBook Pro offline ledger to Firebase Cloud (Firestore Snapshot Vault)
 */
export async function uploadCloudBackup(isAuto = false): Promise<{
  success: boolean;
  message: string;
  backupId?: string;
  exportedAt?: string;
  borrowersCount?: number;
  villagesCount?: number;
}> {
  try {
    const payload: BackupPayload = generateBackupPayload();
    const dataObj = (payload.keys[STORAGE_KEYS.DATA] as any) || { villages: [], borrowers: {} };
    const villages = dataObj.villages || [];
    const allBorrowers = Object.values(dataObj.borrowers || {}).flat() as any[];
    const totalLent = allBorrowers.reduce((s, b) => s + (Number(b.loanAmt) || 0), 0);
    const profile = DB.get<any>(STORAGE_KEYS.PROFILE, {});

    const lenderId = await ensureFirebaseAuth();
    const backupId = `bk_${Date.now()}`;
    const exportedAt = new Date().toISOString();
    const jsonStr = JSON.stringify(payload);

    // Save Snapshot Document to Firestore
    const backupRecord: CloudBackupRecord = {
      backupId,
      lenderId,
      businessName: profile.businessName || "Sri Lakshmi Ganapati",
      exportedAt,
      version: "3.5",
      villagesCount: villages.length,
      borrowersCount: allBorrowers.length,
      totalLent,
      dataJson: jsonStr,
      auto: isAuto,
    };

    // Save to lender's cloud backups subcollection
    const backupDocRef = doc(db, "lenders", lenderId, "backups", backupId);
    await setDoc(backupDocRef, backupRecord);

    // Update parent lender profile summary in Firestore
    const lenderDocRef = doc(db, "lenders", lenderId);
    await setDoc(
      lenderDocRef,
      {
        lenderId,
        businessName: profile.businessName || "Sri Lakshmi Ganapati",
        lastBackupAt: exportedAt,
        lastBackupId: backupId,
        villagesCount: villages.length,
        borrowersCount: allBorrowers.length,
        totalLent,
      },
      { merge: true }
    );

    // Track local timestamp
    localStorage.setItem("slg_last_cloud_backup", exportedAt);

    return {
      success: true,
      message: "Cloud backup completed successfully ✓",
      backupId,
      exportedAt,
      borrowersCount: allBorrowers.length,
      villagesCount: villages.length,
    };
  } catch (error: any) {
    console.error("Cloud Backup Error:", error);
    return {
      success: false,
      message: error?.message || "Failed to create cloud backup. Check network connection.",
    };
  }
}

/**
 * Fetch all cloud backup snapshots available for this lender
 */
export async function getCloudBackupsList(): Promise<CloudBackupRecord[]> {
  try {
    const lenderId = await ensureFirebaseAuth();
    const backupsColRef = collection(db, "lenders", lenderId, "backups");
    const q = query(backupsColRef, orderBy("exportedAt", "desc"), limit(15));
    const snapshot = await getDocs(q);

    const list: CloudBackupRecord[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as CloudBackupRecord);
    });

    return list;
  } catch (error) {
    console.warn("Could not retrieve cloud backups list:", error);
    return [];
  }
}

/**
 * Restore an exact snapshot from Firebase Cloud
 */
export async function restoreFromCloudBackup(record: CloudBackupRecord): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    if (!record.dataJson) {
      throw new Error("Backup snapshot data is empty.");
    }

    const payload = JSON.parse(record.dataJson);
    const result = restoreBackupPayload(payload);

    if (result.success) {
      localStorage.setItem("slg_last_cloud_backup", record.exportedAt);
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Failed to restore cloud snapshot.",
    };
  }
}

/**
 * Delete a cloud backup from Firestore
 */
export async function deleteCloudBackup(backupId: string): Promise<boolean> {
  try {
    const lenderId = await ensureFirebaseAuth();
    const backupDocRef = doc(db, "lenders", lenderId, "backups", backupId);
    await deleteDoc(backupDocRef);
    return true;
  } catch (e) {
    console.error("Failed to delete cloud backup:", e);
    return false;
  }
}

/**
 * Trigger Auto-Backup in the background if enabled and needed
 */
export async function checkAndAutoBackup(force = false): Promise<void> {
  try {
    const isAutoDisabled = localStorage.getItem("slg_auto_cloud_disabled") === "true";
    if (isAutoDisabled && !force) return;

    const last = localStorage.getItem("slg_last_cloud_backup");
    const now = Date.now();

    // Auto-backup if never backed up, or more than 4 hours have passed, or force
    if (!last || force || now - new Date(last).getTime() > 4 * 60 * 60 * 1000) {
      await uploadCloudBackup(true);
    }
  } catch (e) {
    // Silent fail for background tasks
    console.warn("Background auto-backup skipped:", e);
  }
}
