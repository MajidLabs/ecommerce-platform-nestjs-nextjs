import { Badge } from './ui/Badge';

interface StockBadgeProps {
  quantity?: number;
  reserved?: number;
}

// The signature thread running through this whole app: stock state is
// never hidden. A shopper sees the same "3 left" signal the admin sees on
// the inventory and low-stock report — one honest number, two audiences.
export function StockBadge({ quantity, reserved }: StockBadgeProps) {
  if (quantity === undefined) return null;
  const available = quantity - (reserved || 0);

  if (available <= 0) {
    return <Badge tone="muted">Out of stock</Badge>;
  }
  if (available <= 5) {
    return <Badge tone="brick">Only {available} left</Badge>;
  }
  return <Badge tone="signal">In stock</Badge>;
}

export function isAvailable(quantity?: number, reserved?: number): boolean {
  if (quantity === undefined) return false;
  return quantity - (reserved || 0) > 0;
}
