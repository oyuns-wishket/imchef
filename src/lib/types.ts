export interface SessionData {
  userId: string;
  loginId: string;
  nickname: string;
}

export interface RecipeFormData {
  title: string;
  description: string;
  servings: number;
  cookTime: number | null;
  difficulty: "easy" | "normal" | "hard";
  ingredients: { name: string; amount: string; unit: string }[];
  steps: { content: string; order: number }[];
  imageUrls: string[];
}
