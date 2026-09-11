export type Product = { id: string; name: string; price: number; profit_margin: number; image_url: string | null; daily_count: number };
export type Sale = { id: string; product_id: string | null; product_name: string; timestamp: string; price_charged: number; profit_recorded: number };
