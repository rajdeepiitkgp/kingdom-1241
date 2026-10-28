import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, pageAfterResize, pageWindow, parseResultsView, resultsQuery, withView } from "@/lib/retro/results-view";

const DEFAULT_VIEW = { page: 1, size: DEFAULT_PAGE_SIZE, namesHidden: false, darkPaper: false };

describe("parseResultsView", () => {
  it("reads the page, its size, the names switch and the paper from search params", () => {
    expect(parseResultsView({})).toEqual(DEFAULT_VIEW);
    expect(parseResultsView({ page: "3", size: "25", names: "hidden", paper: "dark" })).toEqual({ page: 3, size: 25, namesHidden: true, darkPaper: true });
  });

  it("falls back to the default view on anything odd", () => {
    for (const page of ["0", "-2", "abc", "1.5", "99999", ""]) expect(parseResultsView({ page }).page, page).toBe(1);
    for (const size of ["10", "0", "5.0", "abc", ""]) expect(parseResultsView({ size }).size, size).toBe(DEFAULT_PAGE_SIZE);
    expect(parseResultsView({ page: ["2", "3"] }).page).toBe(1);
    expect(parseResultsView({ names: "shown" }).namesHidden).toBe(false);
    expect(parseResultsView({ names: ["hidden"] }).namesHidden).toBe(false);
    expect(parseResultsView({ paper: "light" }).darkPaper).toBe(false);
  });

  it("reads a delete form's hidden fields too", () => {
    const form = new FormData();
    form.set("page", "2");
    form.set("size", "5");
    form.set("names", "hidden");
    expect(parseResultsView(form)).toEqual({ ...DEFAULT_VIEW, page: 2, size: 5, namesHidden: true });
    expect(parseResultsView(new FormData())).toEqual(DEFAULT_VIEW);
  });
});

describe("pageWindow", () => {
  it("offers 5, 15 or 25 answers per page, 15 by default", () => {
    expect(PAGE_SIZES).toEqual([5, 15, 25]);
    expect(DEFAULT_PAGE_SIZE).toBe(15);
  });

  it("slices the newest-first list into pages", () => {
    expect(pageWindow(1, 45)).toEqual({ page: 1, pages: 3, from: 0, to: 15 });
    expect(pageWindow(3, 45, 25)).toEqual({ page: 2, pages: 2, from: 25, to: 45 });
    expect(pageWindow(2, 10, 5)).toEqual({ page: 2, pages: 2, from: 5, to: 10 });
  });

  it("keeps one empty page without answers and clamps pages that don't exist", () => {
    expect(pageWindow(1, 0)).toEqual({ page: 1, pages: 1, from: 0, to: 0 });
    expect(pageWindow(5, 16)).toEqual({ page: 2, pages: 2, from: 15, to: 16 });
    expect(pageWindow(0, 16).page).toBe(1);
  });

  it("keeps the first answer in view when the page size changes", () => {
    // Page 3 of 5 per page starts at answer 11 (index 10): with 15 per page that is page 1, with 25 page 1, back to 5 page 3.
    expect(pageAfterResize(10, 15)).toBe(1);
    expect(pageAfterResize(30, 15)).toBe(3);
    expect(pageAfterResize(30, 25)).toBe(2);
    expect(pageAfterResize(10, 5)).toBe(3);
    expect(pageAfterResize(-1, 5)).toBe(1);
  });
});

describe("resultsQuery", () => {
  it("leaves the defaults out", () => {
    expect(resultsQuery({})).toBe("");
    expect(resultsQuery(DEFAULT_VIEW)).toBe("");
    expect(resultsQuery({ page: 2 })).toBe("page=2");
    expect(resultsQuery({ page: 2, size: 25, namesHidden: true, darkPaper: true })).toBe("page=2&size=25&names=hidden&paper=dark");
    expect(withView("/en/admin/feedback/x", { namesHidden: true })).toBe("/en/admin/feedback/x?names=hidden");
    expect(withView("/en/admin/feedback/x", {})).toBe("/en/admin/feedback/x");
  });
});
