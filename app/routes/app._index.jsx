import { useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

const FUNCTION_HANDLE = "tiered-order-discount";
const DEFAULT_CODE = "TIERED";
const DISCOUNT_TITLE_PREFIX = "Tiered order discount";

const TIERS = [
  { range: "Below 50", discount: "No discount" },
  { range: "50 to 999.99", discount: "5%" },
  { range: "1000 to 4999.99", discount: "10%" },
  { range: "5000 and above", discount: "15%" },
];

async function getDiscountByCode(admin, code) {
  const response = await admin.graphql(
    `#graphql
      query DiscountByCode($code: String!) {
        codeDiscountNodeByCode(code: $code) {
          id
          codeDiscount {
            __typename
            ... on DiscountCodeApp {
              title
              status
              startsAt
              endsAt
              codes(first: 5) {
                nodes {
                  code
                }
              }
            }
          }
        }
      }`,
    {
      variables: { code },
    },
  );

  const payload = await response.json();
  const node = payload.data?.codeDiscountNodeByCode;

  if (!node?.codeDiscount) {
    return null;
  }

  return {
    id: node.id,
    ...node.codeDiscount,
    code: node.codeDiscount.codes?.nodes?.[0]?.code || code,
  };
}

async function getTieredDiscountCodes(admin) {
  const response = await admin.graphql(
    `#graphql
      query TieredDiscountCodes {
        discountNodes(first: 50) {
          nodes {
            id
            discount {
              __typename
              ... on DiscountCodeApp {
                title
                status
                codes(first: 5) {
                  nodes {
                    code
                  }
                }
              }
            }
          }
        }
      }`,
  );

  const payload = await response.json();
  const nodes = payload.data?.discountNodes?.nodes || [];

  return nodes
    .filter(
      (node) =>
        node.discount?.__typename === "DiscountCodeApp" &&
        node.discount.title?.startsWith(DISCOUNT_TITLE_PREFIX),
    )
    .map((node) => ({
      id: node.id,
      title: node.discount.title,
      status: node.discount.status,
      code: node.discount.codes?.nodes?.[0]?.code,
    }))
    .filter((discount) => discount.code);
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const discounts = await getTieredDiscountCodes(admin);
  const shopHandle = session.shop.replace(".myshopify.com", "");

  return {
    defaultCode: DEFAULT_CODE,
    discounts,
    discountsUrl: `https://admin.shopify.com/store/${shopHandle}/discounts`,
    tiers: TIERS,
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const code = String(formData.get("code") || DEFAULT_CODE)
    .trim()
    .toUpperCase();
  const studioName = String(formData.get("studioName") || "").trim();

  if (!code) {
    return {
      ok: false,
      message: "Enter a discount code.",
    };
  }

  const existingDiscount = await getDiscountByCode(admin, code);
  const discounts = await getTieredDiscountCodes(admin);

  if (existingDiscount) {
    return {
      ok: true,
      code,
      discount: existingDiscount,
      discounts,
      message: `Discount code ${code} is already ${existingDiscount.status}.`,
    };
  }

  const response = await admin.graphql(
    `#graphql
      mutation CreateTieredDiscount($codeAppDiscount: DiscountCodeAppInput!) {
        discountCodeAppCreate(codeAppDiscount: $codeAppDiscount) {
          codeAppDiscount {
            discountId
            title
            status
            codes(first: 5) {
              nodes {
                code
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        codeAppDiscount: {
          title: studioName
            ? `${DISCOUNT_TITLE_PREFIX} - ${studioName}`
            : DISCOUNT_TITLE_PREFIX,
          code,
          functionHandle: FUNCTION_HANDLE,
          discountClasses: ["ORDER"],
          startsAt: new Date().toISOString(),
          appliesOncePerCustomer: false,
          appliesOnOneTimePurchase: true,
          appliesOnSubscription: false,
          context: {
            all: "ALL",
          },
          combinesWith: {
            orderDiscounts: false,
            productDiscounts: false,
            shippingDiscounts: true,
          },
        },
      },
    },
  );

  const payload = await response.json();
  const result = payload.data?.discountCodeAppCreate;
  const userErrors = result?.userErrors || [];

  if (payload.errors?.length || userErrors.length) {
    return {
      ok: false,
      code,
      message:
        userErrors.map((error) => error.message).join(" ") ||
        payload.errors.map((error) => error.message).join(" "),
    };
  }

  return {
    ok: true,
    code,
    discount: result.codeAppDiscount,
    discounts: [
      ...discounts,
      {
        id: result.codeAppDiscount.discountId,
        title: result.codeAppDiscount.title,
        status: result.codeAppDiscount.status,
        code,
      },
    ],
    message: `Discount code ${code} is active.`,
  };
};

export default function Index() {
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const isSubmitting = fetcher.state === "submitting";
  const result = fetcher.data;
  const discounts = result?.discounts || loaderData.discounts;
  const latestDiscount = result?.discount;

  useEffect(() => {
    if (result?.ok) {
      shopify.toast.show(result.message);
    }
  }, [result, shopify]);

  return (
    <s-page heading="Tiered order discount">
      <s-button slot="primary-action" href={loaderData.discountsUrl}>
        Open Shopify Discounts
      </s-button>

      <s-section heading="Create partner code">
        <fetcher.Form method="post">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Studio partner"
              name="studioName"
              placeholder="Studio A"
              autoComplete="off"
            />
            <s-text-field
              label="Code"
              name="code"
              placeholder={loaderData.defaultCode}
              autoComplete="off"
            />
            <s-button
              type="submit"
              variant="primary"
              {...(isSubmitting ? { loading: true } : {})}
            >
              Create partner code
            </s-button>
          </s-stack>
        </fetcher.Form>

        {result?.message && (
          <s-banner tone={result.ok ? "success" : "critical"}>
            <s-paragraph>{result.message}</s-paragraph>
          </s-banner>
        )}
      </s-section>

      <s-section heading="Partner codes">
        {latestDiscount && (
          <s-banner tone="success">
            <s-paragraph>
              {latestDiscount.codes?.nodes?.[0]?.code || latestDiscount.code} is{" "}
              {latestDiscount.status}.
            </s-paragraph>
          </s-banner>
        )}

        {discounts.length ? (
          <s-stack direction="block" gap="small">
            {discounts.map((discount) => (
              <s-box
                key={discount.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="small">
                  <s-stack direction="inline" justifyContent="space-between">
                    <s-text>{discount.code}</s-text>
                    <s-badge
                      tone={discount.status === "ACTIVE" ? "success" : "attention"}
                    >
                      {discount.status}
                    </s-badge>
                  </s-stack>
                  <s-text>{discount.title}</s-text>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-paragraph>No partner codes yet.</s-paragraph>
        )}
      </s-section>

      <s-section heading="Discount tiers">
        <s-stack direction="block" gap="small">
          {loaderData.tiers.map((tier) => (
            <s-box
              key={tier.range}
              padding="base"
              borderWidth="base"
              borderRadius="base"
            >
              <s-stack direction="inline" justifyContent="space-between">
                <s-text>{tier.range}</s-text>
                <s-text>{tier.discount}</s-text>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Test cart subtotals">
        <s-unordered-list>
          <s-list-item>49: no discount</s-list-item>
          <s-list-item>50: 5%</s-list-item>
          <s-list-item>1000: 10%</s-list-item>
          <s-list-item>5000: 15%</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Function">
        <s-paragraph>{FUNCTION_HANDLE}</s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
