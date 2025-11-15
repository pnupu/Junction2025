export type PreferenceSection = {
  id: string;
  title: string;
  description: string;
  options: string[];
  allowMultiple?: boolean;
};

export type SelectionState = Record<string, string[]>;

export const preferenceSections: PreferenceSection[] = [
  {
    id: "vibe",
    title: "What vibe are you chasing?",
    description: "Sets the tone for the entire experience.",
    options: ["Cozy", "Adventurous", "Celebratory", "Chill AF"],
  },
  {
    id: "focus",
    title: "Pick a focus",
    description: "We will blend the city around this anchor.",
    options: ["Foodie circuit", "Culture hit", "Outdoorsy", "Wellness"],
  },
  {
    id: "diet",
    title: "Food signals",
    description: "Helps us respect everyone’s preferences.",
    options: ["No limits", "Veg-friendly", "Vegan", "Gluten-free"],
    allowMultiple: true,
  },
  {
    id: "budget",
    title: "Budget comfort zone",
    description: "Fast tracks venues in the right range.",
    options: ["Smart", "Comfort", "Premium"],
  },
];

export const createEmptySelections = (): SelectionState =>
  preferenceSections.reduce<SelectionState>((acc, section) => {
    acc[section.id] = [];
    return acc;
  }, {});

