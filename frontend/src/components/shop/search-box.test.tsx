// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchBox } from "./search-box";

const router = { push: vi.fn(), replace: vi.fn() };
const location = { pathname: "/", search: "" };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => location.pathname,
  useSearchParams: () => new URLSearchParams(location.search),
}));
vi.mock("next/image", () => ({ default: () => null }));

const products = [
  { id: 1, name: "Checkered Shirt", slug: "checkered-shirt", final_price_cents: 18000, image: null, category: { name: "Shirts" } },
  { id: 2, name: "Vertical Striped Shirt", slug: "vertical-striped-shirt", final_price_cents: 21200, image: null, category: { name: "Shirts" } },
];

const fetchMock = vi.fn();

function renderBox() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SearchBox />
    </QueryClientProvider>,
  );
  return screen.getByRole("combobox", { name: "Search for products" });
}

beforeEach(() => {
  router.push.mockReset();
  router.replace.mockReset();
  Object.assign(location, { pathname: "/", search: "" });
  fetchMock.mockReset().mockImplementation(async () =>
    new Response(JSON.stringify({ data: products, meta: { total: 12 } }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

describe("SearchBox outside the shop page", () => {
  it("waits for two characters, then suggests matches without pressing Enter", async () => {
    const input = renderBox();

    await userEvent.type(input, "s");
    await new Promise((r) => setTimeout(r, 400));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await userEvent.type(input, "hir");

    const list = await screen.findByRole("listbox", { name: "Matching products" });
    expect(list.querySelectorAll("[role=option]")).toHaveLength(2);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /See all 12 results for “shir”/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/bff/products?search=shir&per_page=6");
  });

  it("highlights the typed text as plain text, never as HTML", async () => {
    const input = renderBox();
    await userEvent.type(input, "shirt");

    const strong = await screen.findAllByText("Shirt", { selector: "strong" });
    expect(strong[0]).toBeInTheDocument();
  });

  it("opens a suggestion from the keyboard", async () => {
    const input = renderBox();
    await userEvent.type(input, "shirt");
    await screen.findByRole("listbox");

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    expect(input.getAttribute("aria-activedescendant")).toMatch(/-1$/);

    await userEvent.keyboard("{Enter}");
    expect(router.push).toHaveBeenCalledWith("/product/vertical-striped-shirt");
  });

  it("closes on Escape but keeps the typed text", async () => {
    const input = renderBox();
    await userEvent.type(input, "shirt");
    await screen.findByRole("listbox");

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("shirt");
  });

  it("says so when nothing matches", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ data: [], meta: { total: 0 } }), { status: 200 }));
    const input = renderBox();

    await userEvent.type(input, "xyzq");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No products found for “xyzq”."));
  });

  it("opens the full results on Enter", async () => {
    const input = renderBox();
    await userEvent.type(input, "polo shirt{Enter}");

    expect(router.push).toHaveBeenCalledWith("/shop?search=polo%20shirt");
  });
});

describe("SearchBox on the shop page", () => {
  it("filters the listing live and keeps the other filters", async () => {
    Object.assign(location, { pathname: "/shop", search: "?colors=Blue&page=3&sort=price_asc" });
    const input = renderBox();

    await userEvent.type(input, "jean");

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/shop?search=jean&colors=Blue&sort=price_asc", { scroll: false }),
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops the Best Match sort when the search is cleared", async () => {
    Object.assign(location, { pathname: "/shop", search: "?search=jean&sort=relevance" });
    const input = renderBox();

    await userEvent.clear(input);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/shop", { scroll: false }));
  });
});
