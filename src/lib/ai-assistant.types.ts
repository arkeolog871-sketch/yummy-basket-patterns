/** Sipariş asistanının istemci ile paylaştığı tipler (tarayıcı güvenli modül). */
export type AssistantMessage = { role: "user" | "assistant"; content: string };

export type ProposalLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
};

export type CartProposal = {
  restaurant: {
    id: string;
    slug: string;
    name: string;
    deliveryFee: number;
    deliveryType: string | null;
    minOrder: number;
    deliveryMinutes: number;
  };
  lines: ProposalLine[];
  subtotal: number;
};
