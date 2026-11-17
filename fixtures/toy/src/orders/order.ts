// Toy repo file behind the `Order` entity of the docdive fixture: what the viewer shows inline.
export type OrderStatus = "draft" | "pending" | "paid";

export interface Order {
  id?: number;
  status: OrderStatus;
  items: number;
  total: number;
  payment?: "authorized" | "captured";
}
