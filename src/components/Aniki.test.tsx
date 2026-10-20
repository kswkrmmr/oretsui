import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Aniki } from "./Aniki";

describe("Aniki", () => {
  afterEach(() => {
    cleanup();
  });

  it("場面のセリフと、場面に合った表情の画像を「兄貴」として出す", () => {
    render(<Aniki scene="failed" />);
    expect(screen.getByTestId("aniki-line")).toHaveTextContent(
      "すまん、道が見つからなかった。もう一回いいか？",
    );
    const face = screen.getByRole("img", { name: "兄貴" });
    expect(face.getAttribute("src")).toContain(
      encodeURIComponent("/aniki/troubled.png"),
    );
  });

  it("場面が変わると表情も変わる", () => {
    const { rerender } = render(<Aniki scene="ready" />);
    const src = () =>
      screen.getByRole("img", { name: "兄貴" }).getAttribute("src");
    expect(src()).toContain(encodeURIComponent("/aniki/normal.png"));
    rerender(<Aniki scene="found" />);
    expect(src()).toContain(encodeURIComponent("/aniki/smile.png"));
    rerender(<Aniki scene="almost" />);
    expect(src()).toContain(encodeURIComponent("/aniki/fired-up.png"));
  });
});
