export interface CreateSubscriptionDto {
  packageId: string;
}

export interface UpdateSubscriptionDto {
  status?: 'pending' | 'active' | 'expired' | 'cancelled';
  paymentStatus?: 'pending' | 'completed' | 'failed';
  paymentMethod?: string;
  transactionId?: string;
}

export interface SubscriptionResponse {
  _id: string;
  userId: string;
  packageId: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  startDate?: string;
  endDate?: string;
  propertiesUsed: number;
  paymentStatus: 'pending' | 'completed' | 'failed';
  paymentMethod?: string;
  transactionId?: string;
  createdAt?: string;
  updatedAt?: string;
  package?: {
    _id: string;
    name: string;
    price: number;
    duration: number;
    propertyLimit: number;
  };
}
