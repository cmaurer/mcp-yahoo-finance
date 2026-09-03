import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getNews } from "../../src/tools/getNews.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_news", () => {
  it("maps news articles from search()", async () => {
    const spy = vi.spyOn(yf, "search").mockResolvedValue({
      news: [
        {
          title: "Apple hits new high", publisher: "Reuters",
          link: "https://example.com/a", providerPublishTime: new Date("2026-09-01T14:00:00Z"),
          type: "STORY", relatedTickers: ["AAPL"],
        },
      ],
    } as never);
    const out = (await getNews.handler({ symbol: "AAPL", count: 3 })) as any;
    expect(out).toEqual({
      symbol: "AAPL",
      articles: [
        {
          title: "Apple hits new high", publisher: "Reuters", link: "https://example.com/a",
          publishedAt: "2026-09-01T14:00:00.000Z", type: "STORY", relatedTickers: ["AAPL"],
        },
      ],
    });
    expect(spy).toHaveBeenCalledWith("AAPL", expect.objectContaining({ newsCount: 3, quotesCount: 0 }));
  });

  it("returns an empty list when there is no news", async () => {
    vi.spyOn(yf, "search").mockResolvedValue({} as never);
    const out = (await getNews.handler({ symbol: "AAPL", count: 10 })) as any;
    expect(out).toEqual({ symbol: "AAPL", articles: [] });
  });
});
