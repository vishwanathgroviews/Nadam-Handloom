import { prisma } from '../../config/prisma';

// A product's real availability is its legacy `stock` counter (pre-barcode
// backlog) plus however many of its Piece rows are still in_stock. Every
// product can carry both pools at once — a unit received via the barcode
// intake flow (receivePieces, inventory.service.ts) only ever creates Piece
// rows and never touches `stock` — so nothing that shows "in stock" to a
// customer or a shopper may look at `stock` alone. Shared by the admin
// catalog service and the customer-facing one so "in stock" means exactly
// the same thing everywhere a product is displayed or sold.
export const withAvailability = async <T extends { id: string; stock: number }>(
  products: T[]
): Promise<(T & { availableCount: number })[]> => {
  return Promise.all(
    products.map(async (product) => ({
      ...product,
      availableCount: product.stock + (await prisma.piece.count({ where: { productId: product.id, status: 'in_stock' } })),
    }))
  );
};

export const withAvailabilityOne = async <T extends { id: string; stock: number }>(
  product: T
): Promise<T & { availableCount: number }> => {
  const [withCount] = await withAvailability([product]);
  return withCount!;
};
