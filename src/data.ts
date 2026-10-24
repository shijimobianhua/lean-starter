import type {
  WeightUnit,
  WeightPlan,
  ExerciseDefinition,
  WorkoutItem,
} from "./domain";
import Dexie, { type Table } from "dexie";
export type ThemeMode = "light" | "dark" | "system";
export interface Profile {
  id: string;
  heightCm?: number;
  chestCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  gender?: "male" | "female";
  onboardingDone?: boolean;
  hiddenQuotes?: string[];
  weightUnit?: WeightUnit;
  weightPlan?: WeightPlan | null;
  widgets?: ("quote" | "weight")[];
  customExercises?: ExerciseDefinition[];
  favoriteExercises?: string[];
  style?: "default" | "lean";
}
export interface WeightEntry {
  date: string;
  weightKg: number;
  updatedAt: string;
}
export interface WaterEntry {
  date: string;
  morningMl: number;
  noonMl: number;
  eveningMl: number;
}
export interface SleepEntry {
  wakeDate: string;
  startAt: string;
  endAt: string;
  timeZone: string;
}
export interface TrainingEntry {
  items?: WorkoutItem[];
  date: string;
  status: "trained" | "rest";
  aerobic: string;
  anaerobic: string;
  updatedAt: string;
}
export interface PhotoEntry {
  id: string;
  date: string;
  image: Blob;
  createdAt: string;
}
export interface QuoteContent {
  text: string;
  translation: string;
  source: string;
  language: "zh" | "en";
}
export interface Quote extends QuoteContent {
  id: string;
  effectiveFrom: string;
  updatedAt: string;
}
export interface DailyQuote extends QuoteContent {
  date: string;
}
export interface MuscleAnalysisProvider {
  analyze(photo: Blob): Promise<{ stage: string; confidence?: number }>;
}
const originalSchema = {
  weights: "date",
  water: "date",
  sleep: "wakeDate",
  photos: "id,date",
  profile: "id",
};
export class FormDatabase extends Dexie {
  weights!: Table<WeightEntry, string>;
  water!: Table<WaterEntry, string>;
  sleep!: Table<SleepEntry, string>;
  training!: Table<TrainingEntry, string>;
  quotes!: Table<Quote, string>;
  dailyQuotes!: Table<DailyQuote, string>;
  photos!: Table<PhotoEntry, string>;
  profile!: Table<Profile, string>;
  constructor(name = "form-daily") {
    super(name);
    this.version(1).stores(originalSchema);
    this.version(2).stores({ ...originalSchema, training: "date" });
    this.version(3).stores({
      ...originalSchema,
      training: "date",
      quotes: "id,effectiveFrom",
      dailyQuotes: "date",
    });
  }
}
export const db = new FormDatabase();
