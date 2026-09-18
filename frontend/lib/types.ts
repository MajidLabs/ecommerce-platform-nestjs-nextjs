export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';
export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  children?: Category[];
  _count?: { products: number };
}

export interface Inventory {
  id: string;
  productId: string;
  quantity: number;
  reserved: number;
  reorderLevel: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  images: string[];
  isActive: boolean;
  categoryId: string;
  category?: Category;
  inventory?: Inventory;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
}

export interface Cart {
  id: string;
  items: CartItem[];
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  product: Product;
}

export interface Order {
  id: string;
  status: OrderStatus;
  subtotal: string;
  discountAmount: string;
  totalAmount: string;
  shippingLine1: string;
  shippingCity: string;
  shippingState?: string;
  shippingPostal: string;
  shippingCountry: string;
  items: OrderItem[];
  user?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;
  payment?: { status: string; providerRef?: string };
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: string;
  minOrderAmount?: string;
  maxDiscountAmount?: string;
  usageLimit?: number;
  usedCount: number;
  validUntil?: string;
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  type: 'RESTOCK' | 'SALE' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  reason?: string;
  createdAt: string;
}

export interface SalesSummary {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  product?: Product;
  totalSold: number;
}
