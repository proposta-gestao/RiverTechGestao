export interface Client {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  type: 'VIP' | 'Funcionário' | 'Convidado';
  profile: 'VIP Diretoria' | 'Funcionários' | 'Convidados' | 'Cortesia';
  monthlyLimit: number;
  consumed: number;
  status: 'ativo' | 'bloqueado';
  password: string;
  notes?: string;
}

export interface MenuProfile {
  id: string;
  name: string;
  categories: string[];
  products: string[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image?: string;
  popular?: boolean;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export const mockClients: Client[] = [
  {
    id: '1',
    name: 'Carlos Eduardo Silva',
    cpf: '123.456.789-00',
    phone: '(11) 98765-4321',
    type: 'VIP',
    profile: 'VIP Diretoria',
    monthlyLimit: 5000,
    consumed: 3250,
    status: 'ativo',
    password: '1234',
    notes: 'Cliente preferencial desde 2023'
  },
  {
    id: '2',
    name: 'Marina Costa Oliveira',
    cpf: '987.654.321-00',
    phone: '(11) 98765-1234',
    type: 'VIP',
    profile: 'VIP Diretoria',
    monthlyLimit: 4500,
    consumed: 4200,
    status: 'ativo',
    password: '5678'
  },
  {
    id: '3',
    name: 'Roberto Santos',
    cpf: '456.789.123-00',
    phone: '(11) 97654-3210',
    type: 'Funcionário',
    profile: 'Funcionários',
    monthlyLimit: 1500,
    consumed: 850,
    status: 'ativo',
    password: '9012'
  },
  {
    id: '4',
    name: 'Ana Paula Lima',
    cpf: '321.654.987-00',
    phone: '(11) 96543-2109',
    type: 'Funcionário',
    profile: 'Funcionários',
    monthlyLimit: 1500,
    consumed: 1450,
    status: 'ativo',
    password: '3456'
  },
  {
    id: '5',
    name: 'Fernando Almeida',
    cpf: '789.123.456-00',
    phone: '(11) 95432-1098',
    type: 'Convidado',
    profile: 'Convidados',
    monthlyLimit: 800,
    consumed: 200,
    status: 'ativo',
    password: '7890'
  },
];

export const mockMenuProfiles: MenuProfile[] = [
  {
    id: '1',
    name: 'VIP Diretoria',
    categories: ['Bebidas alcoólicas', 'Drinks especiais', 'Carnes', 'Petiscos', 'Sobremesas'],
    products: ['Whisky', 'Heineken', 'Água', 'Refrigerante', 'Picanha']
  },
  {
    id: '2',
    name: 'Funcionários',
    categories: ['Petiscos', 'Sobremesas'],
    products: ['Água', 'Refrigerante']
  },
  {
    id: '3',
    name: 'Convidados',
    categories: ['Petiscos'],
    products: ['Água', 'Refrigerante']
  },
  {
    id: '4',
    name: 'Cortesia',
    categories: ['Petiscos', 'Sobremesas'],
    products: ['Água']
  },
];

export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Whisky Premium',
    category: 'Bebidas alcoólicas',
    price: 250.00,
    popular: true
  },
  {
    id: '2',
    name: 'Heineken Long Neck',
    category: 'Bebidas alcoólicas',
    price: 15.00,
    popular: true
  },
  {
    id: '3',
    name: 'Água Mineral',
    category: 'Bebidas',
    price: 5.00
  },
  {
    id: '4',
    name: 'Refrigerante Lata',
    category: 'Bebidas',
    price: 8.00
  },
  {
    id: '5',
    name: 'Picanha Premium 400g',
    category: 'Carnes',
    price: 120.00,
    popular: true
  },
  {
    id: '6',
    name: 'Batata Frita com Cheddar',
    category: 'Petiscos',
    price: 35.00,
    popular: true
  },
  {
    id: '7',
    name: 'Tiramisu',
    category: 'Sobremesas',
    price: 28.00
  },
  {
    id: '8',
    name: 'Mojito',
    category: 'Drinks especiais',
    price: 32.00
  },
];

export const allCategories = [
  'Bebidas alcoólicas',
  'Drinks especiais',
  'Carnes',
  'Petiscos',
  'Sobremesas',
];

export const allProducts = [
  'Whisky',
  'Heineken',
  'Água',
  'Refrigerante',
  'Picanha',
];
