import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConditionSheet } from "./ConditionSheet";

const button = (name: string) => screen.getByRole("button", { name });
const generate = () => fireEvent.click(button("ルートを作る"));

describe("ConditionSheet", () => {
  afterEach(() => {
    cleanup();
  });

  it("初期値は「時間」・30分・ふつうで、約2.4km と表示する", () => {
    render(<ConditionSheet disabled={false} onGenerate={vi.fn()} />);
    expect(button("時間")).toHaveAttribute("aria-pressed", "true");
    expect(button("30分")).toHaveAttribute("aria-pressed", "true");
    expect(button("ふつう")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("約2.4km")).toBeInTheDocument();
  });

  it("時間と速さを選んで「ルートを作る」を押すと、換算した距離で生成処理を呼ぶ", () => {
    const onGenerate = vi.fn();
    render(<ConditionSheet disabled={false} onGenerate={onGenerate} />);
    fireEvent.click(button("60分"));
    fireEvent.click(button("早歩き"));
    expect(button("60分")).toHaveAttribute("aria-pressed", "true");
    expect(button("30分")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("約6.0km")).toBeInTheDocument();
    generate();
    expect(onGenerate).toHaveBeenCalledWith(6000, "fast");
  });

  it("「距離」に切り替えると速さの選択が隠れ、選んだ距離で生成処理を呼ぶ", () => {
    const onGenerate = vi.fn();
    render(<ConditionSheet disabled={false} onGenerate={onGenerate} />);
    fireEvent.click(button("距離"));
    expect(screen.queryByRole("button", { name: "ふつう" })).toBeNull();
    expect(screen.queryByRole("button", { name: "30分" })).toBeNull();
    fireEvent.click(button("3km"));
    generate();
    expect(onGenerate).toHaveBeenCalledWith(3000, "normal");
  });

  it("モードを切り替えて戻っても、時間の選択は残る", () => {
    const onGenerate = vi.fn();
    render(<ConditionSheet disabled={false} onGenerate={onGenerate} />);
    fireEvent.click(button("15分"));
    fireEvent.click(button("距離"));
    fireEvent.click(button("時間"));
    expect(button("15分")).toHaveAttribute("aria-pressed", "true");
    generate();
    expect(onGenerate).toHaveBeenCalledWith(1200, "normal");
  });

  it("出発点がないとき（disabled）、「ルートを作る」は押せない", () => {
    const onGenerate = vi.fn();
    render(<ConditionSheet disabled onGenerate={onGenerate} />);
    expect(button("ルートを作る")).toBeDisabled();
    generate();
    expect(onGenerate).not.toHaveBeenCalled();
  });
});
