export interface IceCreamIngredient {
  id: string;
  name: string;
  category: "base" | "flavor" | "topping";
  icon: string;
  color: string;
}

export const ICE_CREAM_INGREDIENTS: IceCreamIngredient[] = [
  { id: "cone", name: "Waffle Cone", category: "base", icon: "🧇", color: "#d4a373" },
  { id: "cup", name: "Cup", category: "base", icon: "🥣", color: "#e9edc9" },
  { id: "vanilla", name: "Vanilla Scoop", category: "flavor", icon: "🍦", color: "#fefae0" },
  { id: "strawberry", name: "Strawberry Scoop", category: "flavor", icon: "🍓", color: "#ffb4a2" },
  { id: "chocolate", name: "Chocolate Scoop", category: "flavor", icon: "🍫", color: "#6f4e37" },
  { id: "mint", name: "Mint Scoop", category: "flavor", icon: "🍃", color: "#b7e4c7" },
  { id: "sprinkles", name: "Rainbow Sprinkles", category: "topping", icon: "✨", color: "#f72585" },
  { id: "cherry", name: "Red Cherry", category: "topping", icon: "🍒", color: "#d90429" },
];
