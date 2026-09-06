type TicketArgs = {
  orderKind: "marketplace" | "aevonsmp";
  orderId: string;
  orderCode: string;
  userId: string;
  customerEmail: string;
  productName: string;
  amount: number;
};

export async function ensureGcashTicket(admin: any, args: TicketArgs) {
  const { data: existing } = await admin
    .from("gcash_tickets")
    .select("id")
    .eq("order_kind", args.orderKind)
    .eq("order_id", args.orderId)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data, error } = await admin
    .from("gcash_tickets")
    .insert({
      order_kind: args.orderKind,
      order_id: args.orderId,
      order_code: args.orderCode,
      user_id: args.userId,
      customer_email: args.customerEmail,
      product_name: args.productName,
      amount: args.amount,
      status: "open",
      subject: `GCash Payment — ${args.productName}`
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message || "Could not create GCash ticket.");
  return data.id as string;
}

export async function syncTicketStatus(admin: any, orderKind: "marketplace" | "aevonsmp", orderId: string, status: "approved" | "rejected") {
  await admin
    .from("gcash_tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("order_kind", orderKind)
    .eq("order_id", orderId);
}
