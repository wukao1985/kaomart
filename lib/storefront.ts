import { Product } from "./types";

const STOREFRONT_URL =
  "https://kaomart-2.myshopify.com/api/2024-01/graphql.json";
const STORE_DOMAIN = "kaomart-2.myshopify.com";

const SEARCH_QUERY = `
  query SearchProducts($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          description
          featuredImage {
            url
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          variants(first: 1) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    }
  }
`;

interface StorefrontProductNode {
  id: string;
  title: string;
  description: string;
  featuredImage: { url: string } | null;
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  variants: {
    edges: Array<{ node: { id: string } }>;
  };
}

function variantIdToCheckoutUrl(gid: string): string {
  // gid://shopify/ProductVariant/12345 → numeric id
  const numericId = gid.split("/").pop() || "";
  return `https://${STORE_DOMAIN}/cart/${numericId}:1`;
}

export async function searchStorefrontProducts(
  query: string,
  limit: number = 3
): Promise<Product[]> {
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
  if (!token) {
    throw new Error("SHOPIFY_STOREFRONT_TOKEN is not configured");
  }

  const res = await fetch(STOREFRONT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: { query, first: limit },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storefront API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const edges: Array<{ node: StorefrontProductNode }> =
    json?.data?.products?.edges || [];

  return edges.map(({ node }) => {
    const variantGid = node.variants.edges[0]?.node?.id || "";
    return {
      id: node.id,
      title: node.title,
      price: node.priceRange.minVariantPrice.amount,
      currency: node.priceRange.minVariantPrice.currencyCode,
      image: node.featuredImage?.url || "",
      rating: 0,
      checkoutUrl: variantGid ? variantIdToCheckoutUrl(variantGid) : "#",
      vendor: "KaoMart",
    };
  });
}
