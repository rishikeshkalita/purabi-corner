import { Product, Sale } from './types';

export const demoProducts: Product[] = [
  { id: '1', name: 'Fresh Milk 500ml', price: 32, profit_margin: 7, image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500', daily_count: 18 },
  { id: '2', name: 'Fresh Milk 1L', price: 62, profit_margin: 14, image_url: 'https://images.unsplash.com/photo-1600788907416-456578634209?w=500', daily_count: 11 },
  { id: '3', name: 'Curd 400g', price: 35, profit_margin: 9, image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500', daily_count: 9 },
  { id: '4', name: 'Paneer 200g', price: 88, profit_margin: 18, image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500', daily_count: 7 },
  { id: '5', name: 'Lassi', price: 28, profit_margin: 8, image_url: 'https://images.unsplash.com/photo-1576186726115-4d51596775d1?w=500', daily_count: 6 },
  { id: '6', name: 'Buttermilk', price: 20, profit_margin: 6, image_url: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=500', daily_count: 5 },
];

export const demoSales: Sale[] = demoProducts.flatMap((p, idx) =>
  Array.from({ length: p.daily_count }, (_, i) => ({
    id: `${p.id}-${i}`,
    product_id: p.id,
    product_name: p.name,
    timestamp: new Date(Date.now() - (idx * 21 + i * 37) * 60000).toISOString(),
    price_charged: p.price,
    profit_recorded: p.profit_margin,
  })),
);
