import ShoppingPage from "@/components/ShoppingPage";

export default function GlobalPage() {
  return (
    <ShoppingPage
      mode="global"
      sessionStorageKey="kaomart_global_session"
      apiRoute="/api/chat"
      placeholder="Search millions of products worldwide..."
      title="Global Shopping"
    />
  );
}
