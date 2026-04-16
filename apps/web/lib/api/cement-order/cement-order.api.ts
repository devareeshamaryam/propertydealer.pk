import api from '@/lib/api';

export interface CementOrderItem {
  brand: string;
  productId: string;
  city: string;
  weightKg: number;
  price: number;
  quantity: number;
  image?: string;
}

export interface CementOrderData {
  _id?: string;
  customerName: string;
  customerEmail: string;
  userId: string;
  customerPhone: string;
  address: string;
  deliveryInstruction?: string;
  items: CementOrderItem[];
  subTotal: number;
  deliveryCharges: number;
  total: number;
  status: string;
  paymentMethod: string;
  createdAt?: string;
}

class CementOrderApi {
  async createOrder(data: Omit<CementOrderData, '_id' | 'status' | 'createdAt'>): Promise<CementOrderData> {
    const response = await api.post('/cement-order', data);
    return response.data;
  }

  async getAllOrders(): Promise<CementOrderData[]> {
    const response = await api.get('/cement-order');
    return response.data;
  }
}

export default new CementOrderApi();
