import ShoppingPage from "@/components/ShoppingPage";

export default function KaoMartPage() {
  return (
    <ShoppingPage
      mode="kaomart"
      sessionStorageKey="kaomart_store_session"
      apiRoute="/api/chat/storefront"
      placeholder="Search KaoMart store products..."
      title="KaoMart Store"
    />
  );
}
