import type { ExerciseDefinition, WeightPlan, WorkoutItem } from "./domain";
// Reserved contracts only. No provider is registered and no request is made in v1.5.0.
export interface AuthorityDataset {
  id: string;
  publisher: string;
  version: string;
  sourceUrl: string;
  reviewedAt: string;
}
export interface ExerciseCatalogProvider {
  catalog(
    version?: string,
  ): Promise<{
    version: string;
    source: AuthorityDataset;
    items: ExerciseDefinition[];
  }>;
}
export interface WeightKnowledgeProvider {
  sources(): Promise<AuthorityDataset[]>;
  lookup(plan: WeightPlan): Promise<{ sourceIds: string[]; notes: string[] }>;
}
export interface WeightAnalysisProvider {
  analyze(input: {
    plan: WeightPlan;
    weights: { date: string; weightKg: number }[];
    workouts: WorkoutItem[];
  }): Promise<{ summary: string; sourceIds: string[]; generatedAt: string }>;
}
export const futureProviders: {
  catalog?: ExerciseCatalogProvider;
  knowledge?: WeightKnowledgeProvider;
  analysis?: WeightAnalysisProvider;
} = {};
