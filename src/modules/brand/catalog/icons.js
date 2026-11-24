/**
 * Curated Lucide (ISC-licensed) icons offered to the AI and the logo editor,
 * grouped by theme. Names must exist in the `lucide` package (unit-tested).
 */
export const ICON_GROUPS = {
  "Food & drink": ["Coffee", "CupSoda", "Croissant", "Cake", "CakeSlice", "Pizza", "Sandwich", "Soup", "Salad", "Wheat", "Cookie", "IceCreamCone", "Utensils", "UtensilsCrossed", "ChefHat", "Wine", "Beer", "Apple", "Cherry", "Carrot", "Citrus", "Grape", "Egg", "Fish", "Beef", "Milk", "Candy", "Donut", "Popcorn"],
  "Retail & fashion": ["ShoppingBag", "ShoppingCart", "Store", "Shirt", "Gem", "Crown", "Watch", "Glasses", "Scissors", "Tag", "Gift", "Package", "Footprints"],
  "Beauty, health & wellness": ["Sparkles", "Flower", "Flower2", "Leaf", "Sprout", "TreePine", "Heart", "HeartPulse", "Droplet", "Flame", "Sun", "Moon", "Star", "Feather", "Dumbbell", "Bike", "Activity", "Smile", "Stethoscope", "Pill", "Baby"],
  "Technology": ["Cpu", "Code", "Terminal", "Cloud", "Database", "Wifi", "Smartphone", "Laptop", "Monitor", "Rocket", "Zap", "Bot", "Brain", "CircuitBoard", "Layers", "Hexagon", "Atom", "Globe", "Orbit", "Infinity"],
  "Business & services": ["Briefcase", "Building", "Building2", "Landmark", "Scale", "Handshake", "TrendingUp", "PiggyBank", "Wallet", "Coins", "Calculator", "FileText", "Target", "Award", "Trophy", "Shield", "ShieldCheck", "KeyRound", "Users", "MessageCircle", "Send", "Mail", "Phone", "Calendar", "Clock", "Lightbulb", "Puzzle"],
  "Creative & education": ["PenTool", "Palette", "Paintbrush", "Camera", "Music", "Mic", "Film", "BookOpen", "GraduationCap", "Gamepad2"],
  "Home, travel & outdoors": ["House", "Hammer", "Wrench", "Bed", "Sofa", "Lamp", "Compass", "Map", "MapPin", "Plane", "Car", "Truck", "Ship", "Anchor", "Sailboat", "Mountain", "Waves", "Tent", "Bird", "Dog", "Cat", "PawPrint", "Recycle"],
};

export const ICON_NAMES = Object.values(ICON_GROUPS).flat();
export const ICON_SET = new Set(ICON_NAMES);
