import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANIKI_LINES } from "@/lib/aniki";
import { Aniki } from "./Aniki";

describe("Aniki", () => {
  beforeEach(() => {
    // セリフは候補から乱数で選ぶ（#92）。先頭（今までのセリフ）が選ばれるよう固定する
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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

  it("場面が変わらなければ、描き直してもセリフは変わらない（#92）", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { rerender } = render(<Aniki scene="enRoute" talkId={3} />);
    const line = () => screen.getByTestId("aniki-line").textContent;
    const first = line();
    expect(ANIKI_LINES.enRoute).toContain(first);
    // 乱数が変わっても、同じ場面・同じ番号のあいだは選び直さない
    random.mockReturnValue(0);
    act(() => rerender(<Aniki scene="enRoute" talkId={3} />));
    act(() => rerender(<Aniki scene="enRoute" talkId={3} />));
    expect(line()).toBe(first);
  });

  it("同じ場面でも、一言の番号が変わればセリフを選び直し、前と同じセリフは続けない（#92）", () => {
    const { rerender } = render(<Aniki scene="enRoute" talkId={1} />);
    const line = () => screen.getByTestId("aniki-line").textContent;
    expect(line()).toBe(ANIKI_LINES.enRoute[0]);
    rerender(<Aniki scene="enRoute" talkId={2} />);
    expect(line()).toBe(ANIKI_LINES.enRoute[1]);
    rerender(<Aniki scene="enRoute" talkId={3} />);
    expect(line()).toBe(ANIKI_LINES.enRoute[0]);
  });
});
