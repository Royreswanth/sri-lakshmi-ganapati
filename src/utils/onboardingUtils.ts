import type { BusinessProfile } from "../types.ts";

export type OnboardingStepId = "profile" | "village" | "borrower" | "backup";

export interface OnboardingStep {
  id: OnboardingStepId;
  number: number;
  completed: boolean;
  titleEn: string;
  titleTe: string;
  descEn: string;
  descTe: string;
  ctaEn: string;
  ctaTe: string;
}

export interface OnboardingProgressInput {
  profile: BusinessProfile;
  villagesCount: number;
  borrowersCount: number;
  hasCloudOrLocalBackup: boolean;
}

export interface OnboardingProgressSummary {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  percentComplete: number;
  allComplete: boolean;
  nextStepId: OnboardingStepId | null;
}

export function isBusinessProfileCustomized(profile: BusinessProfile): boolean {
  const name = (profile.businessName || "").trim();
  const owner = (profile.ownerName || "").trim();
  const phone = (profile.phone || "").trim();

  return (
    (name.length > 0 && name !== "LineBook Pro") ||
    (owner.length > 0 && owner !== "Owner / Partner") ||
    phone.length > 0
  );
}

export function computeOnboardingProgress(
  input: OnboardingProgressInput
): OnboardingProgressSummary {
  const profileDone = isBusinessProfileCustomized(input.profile);
  const villageDone = input.villagesCount > 0;
  const borrowerDone = input.borrowersCount > 0;
  const backupDone = Boolean(input.hasCloudOrLocalBackup);

  const steps: OnboardingStep[] = [
    {
      id: "profile",
      number: 1,
      completed: profileDone,
      titleEn: "Setup Business Name & Logo",
      titleTe: "మీ వ్యాపార పేరు & లోగో సెటప్",
      descEn: "Customize receipts with your finance name, phone & emblem",
      descTe: "వాట్సాప్ రశీదులపై మీ ఫైనాన్స్ పేరు, ఫోన్ & లోగో మార్చుకోండి",
      ctaEn: "Setup",
      ctaTe: "సెటప్",
    },
    {
      id: "village",
      number: 2,
      completed: villageDone,
      titleEn: "Add First Line Village",
      titleTe: "మొదటి లైన్ గ్రామాన్ని చేర్చండి",
      descEn: "Schedule villages across Mon–Sun weekly collection days",
      descTe: "సోమ–ఆదివారాలలో వసూలు చేసే మొదటి గ్రామాన్ని చేర్చండి",
      ctaEn: "Add Village",
      ctaTe: "చేర్చండి",
    },
    {
      id: "borrower",
      number: 3,
      completed: borrowerDone,
      titleEn: "Add First Borrower / Loan",
      titleTe: "మొదటి ఖాతాదారుని / అప్పు చేర్చండి",
      descEn: "Record Daily, Weekly, or Monthly loans with guarantor details",
      descTe: "రోజువారీ, వారం లేదా నెలవారీ అప్పు & హామీ వివరాలు నమోదు చేయండి",
      ctaEn: "Add Loan",
      ctaTe: "నమోదు",
    },
    {
      id: "backup",
      number: 4,
      completed: backupDone,
      titleEn: "Enable Cloud / File Backup Vault",
      titleTe: "క్లౌడ్ లేదా ఫైల్ బ్యాకప్ సేవ్ చేయండి",
      descEn: "Connect Google Vault or save a JSON backup to protect your ledger",
      descTe: "ఫోన్ మారినా డేటా పోకుండా Google లేదా JSON బ్యాకప్ చేయండి",
      ctaEn: "Backup",
      ctaTe: "బ్యాకప్",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const percentComplete = Math.round((completedCount / totalCount) * 100);
  const allComplete = completedCount === totalCount;
  const nextStep = steps.find((s) => !s.completed) || null;

  return {
    steps,
    completedCount,
    totalCount,
    percentComplete,
    allComplete,
    nextStepId: nextStep ? nextStep.id : null,
  };
}
