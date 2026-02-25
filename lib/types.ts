export interface Product {
  id: string;
  title: string;
  price: string;
  currency: string;
  image: string;
  rating: number;
  checkoutUrl: string;
  vendor: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  productResults?: Product[];
  createdAt: string;
}

export interface StreamEvent {
  type: "text" | "products" | "done" | "error";
  data: string;
}
