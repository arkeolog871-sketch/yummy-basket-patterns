import { describe, expect, it } from "vitest";
import {
  latestDate,
  parseDownloadsReportText,
  sumCounts,
} from "@/lib/apple-analytics-downloads.server";

describe("parseDownloadsReportText", () => {
  it("sekmeyle ayrılmış Apple raporunu ayrıştırır", () => {
    const text = [
      "Date\tApp Name\tDownload Type\tCounts",
      "2026-11-19\tSilvan Cebimde\tFirst-time Download\t12",
      "2026-11-19\tSilvan Cebimde\tRedownload\t3",
    ].join("\n");
    const rows = parseDownloadsReportText(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      Date: "2026-11-19",
      "App Name": "Silvan Cebimde",
      "Download Type": "First-time Download",
      Counts: "12",
    });
  });

  it("virgülle ayrılmışsa onu da anlar", () => {
    const text = "Date,Counts\n2026-11-19,5";
    expect(parseDownloadsReportText(text)).toEqual([{ Date: "2026-11-19", Counts: "5" }]);
  });

  it("boş metinde çökmez", () => {
    expect(parseDownloadsReportText("")).toEqual([]);
  });
});

describe("sumCounts", () => {
  it("Counts sütununu büyük/küçük harf duyarsız toplar", () => {
    const rows = [
      { Date: "2026-11-19", counts: "12" },
      { Date: "2026-11-19", counts: "3" },
    ];
    expect(sumCounts(rows)).toBe(15);
  });

  it("Counts sütunu yoksa 0 döner", () => {
    expect(sumCounts([{ Date: "2026-11-19" }])).toBe(0);
  });

  it("satır yoksa 0 döner", () => {
    expect(sumCounts([])).toBe(0);
  });
});

describe("latestDate", () => {
  it("en güncel tarihi bulur", () => {
    const rows = [{ Date: "2026-11-18" }, { Date: "2026-11-20" }, { Date: "2026-11-19" }];
    expect(latestDate(rows)).toBe("2026-11-20");
  });

  it("Date sütunu yoksa null döner", () => {
    expect(latestDate([{ Counts: "5" }])).toBeNull();
  });
});
