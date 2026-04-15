export type FuelType =
  | 'gel'
  | 'drink_mix'
  | 'electrolyte'
  | 'capsule'
  | 'bar'
  | 'real_food'
  | 'other';

export type Product = {
  id: string;
  name: string;
  fuel_type: FuelType;
  carbs_g: number | null;
  sodium_mg: number | null;
  calories_kcal: number | null;
  created_by?: string | null;
};

export type FavoriteRow = {
  product_id: string;
  products: Product;
};

export type CreateProductResponse = {
  product?: {
    id: string;
    name: string;
    fuelType: FuelType;
    carbsGrams: number;
    sodiumMg: number;
    caloriesKcal: number;
    createdBy?: string | null;
  };
  message?: string;
  error?: string;
};
